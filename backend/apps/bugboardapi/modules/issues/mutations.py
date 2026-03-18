from django.contrib.auth.models import User
from rest_framework import serializers

from ..tags.models import Tag
from .models import Issue, IssueAssignee, IssueTag


def validate_existing_tag_ids(tag_ids: list[int] | None) -> None:
    if tag_ids is None:
        return
    existing_tag_ids = set(Tag.objects.filter(tag_id__in=tag_ids).values_list("tag_id", flat=True))
    missing_tag_ids = [tag_id for tag_id in tag_ids if tag_id not in existing_tag_ids]
    if missing_tag_ids:
        raise serializers.ValidationError({"tagIds": f"Invalid tag ids: {missing_tag_ids}"})


def resolve_issue_tag_ids(*, tag_ids: list[int], tag_names: list[str]) -> list[int]:
    resolved: list[int] = []
    seen: set[int] = set()

    validate_existing_tag_ids(tag_ids)
    for tag_id in tag_ids:
        if tag_id not in seen:
            seen.add(tag_id)
            resolved.append(tag_id)

    for raw_name in tag_names:
        name = Tag.normalize_name(raw_name)
        if not name:
            continue
        tag = Tag.objects.filter(name__iexact=name).order_by("tag_id").first()
        if not tag:
            tag, _ = Tag.objects.get_or_create(name=name)
        if tag.tag_id not in seen:
            seen.add(tag.tag_id)
            resolved.append(tag.tag_id)

    return resolved


def ensure_issue_assignees(*, issue: Issue, user_ids: list[int]) -> list[User]:
    assignees: list[User] = []
    for user_id in user_ids:
        assignment, _ = IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
        assignees.append(assignment.user)
    return assignees


def add_issue_assignees(*, issue: Issue, user_ids: list[int]) -> list[User]:
    added_assignees: list[User] = []
    for user_id in user_ids:
        assignment, created = IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
        if created:
            added_assignees.append(assignment.user)
    return added_assignees


def remove_issue_assignees(*, issue: Issue, user_ids: list[int]) -> list[User]:
    users = list(User.objects.filter(id__in=user_ids, is_active=True))
    IssueAssignee.objects.filter(issue=issue, user_id__in=user_ids).delete()
    return users


def remove_existing_issue_assignees(*, issue: Issue, user_ids: list[int]) -> list[User]:
    users = list(
        User.objects.filter(
            issue_assignments__issue=issue,
            id__in=user_ids,
        ).distinct()
    )
    IssueAssignee.objects.filter(
        issue=issue,
        user_id__in=[user.id for user in users],
    ).delete()
    return users


def replace_issue_assignees(*, issue: Issue, assignee_ids: list[int]) -> list[User]:
    IssueAssignee.objects.filter(issue=issue).exclude(user_id__in=assignee_ids).delete()
    return ensure_issue_assignees(issue=issue, user_ids=assignee_ids)


def _sync_issue_tags(*, issue: Issue, tag_ids: list[int]) -> None:
    IssueTag.objects.filter(issue=issue).exclude(tag_id__in=tag_ids).delete()
    for tag_id in tag_ids:
        IssueTag.objects.get_or_create(issue=issue, tag_id=tag_id)


def create_issue_from_validated_data(validated_data: dict) -> Issue:
    assignee_ids = validated_data.pop("assigneeIds", [])
    tag_ids = validated_data.pop("tagIds", [])
    tag_names = validated_data.pop("tagNames", [])
    resolved_tag_ids = resolve_issue_tag_ids(tag_ids=tag_ids, tag_names=tag_names)

    issue = Issue.objects.create(**validated_data)
    ensure_issue_assignees(issue=issue, user_ids=assignee_ids)
    for tag_id in resolved_tag_ids:
        IssueTag.objects.get_or_create(issue=issue, tag_id=tag_id)
    return issue


def update_issue_from_validated_data(instance: Issue, validated_data: dict) -> Issue:
    assignee_ids = validated_data.pop("assigneeIds", None)
    tag_ids = validated_data.pop("tagIds", None)
    tag_names = validated_data.pop("tagNames", None)

    for attr, value in validated_data.items():
        setattr(instance, attr, value)
    if validated_data:
        instance.save()

    if assignee_ids is not None:
        replace_issue_assignees(issue=instance, assignee_ids=assignee_ids)

    if tag_ids is not None or tag_names is not None:
        resolved_tag_ids = resolve_issue_tag_ids(tag_ids=tag_ids or [], tag_names=tag_names or [])
        _sync_issue_tags(issue=instance, tag_ids=resolved_tag_ids)

    return instance
