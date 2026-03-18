from functools import partial

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
from ..projects.membership import visible_project_memberships
from ..notifications.services import (
    notify_issue_added,
    notify_issue_assigned,
    notify_issue_closed,
    notify_issue_unassigned,
    notify_issue_updated,
)
from .activity import (
    create_attachment_for_event,
    create_issue_event,
    create_issue_event_with_attachment,
    delete_media_path,
    issue_notification_recipients,
    schedule_issue_event_broadcast,
    validate_issue_event_message,
)
from .models import Attachment, EventType, Issue, IssueEvent, IssueStatus
from .mutations import add_issue_assignees, ensure_issue_assignees, remove_existing_issue_assignees
from .rules import validate_issue_assignment_user_ids

_UNSET = object()


def _project_issue_admin_users(*, project) -> list[User]:
    return [
        membership.user
        for membership in visible_project_memberships(
            project=project,
            include_admins=True,
            active_only=True,
        )
        if is_admin_user(membership.user)
    ]


def _issue_update_recipients(*, issue: Issue, actor=None) -> list[User]:
    return issue_notification_recipients(issue=issue, actor=actor)


def _dispatch_issue_side_effects(
    *,
    issue: Issue,
    actor,
    event_type: str,
    message,
    payload=None,
    notification_sender=None,
    notification_users: list[User] | None = None,
    notification_actor=_UNSET,
    attachments_required: bool = False,
    max_files: int = 10,
    **event_fields,
):
    if payload is None:
        event = create_issue_event(
            issue=issue,
            actor=actor,
            event_type=event_type,
            message=message,
            **event_fields,
        )
    else:
        event = create_issue_event_with_attachment(
            issue=issue,
            actor=actor,
            event_type=event_type,
            message=message,
            payload=payload,
            attachments_required=attachments_required,
            max_files=max_files,
            **event_fields,
        )

    if notification_sender and notification_users:
        notification_kwargs = {
            "users": notification_users,
            "issue": issue,
        }
        if notification_actor is not _UNSET:
            notification_kwargs["actor"] = notification_actor
        notification_sender(**notification_kwargs)

    return event


def _issue_attachment_paths(*, issue: Issue) -> list[str]:
    return list(
        dict.fromkeys(
            path
            for path in Attachment.objects.filter(update__issue=issue).values_list("path", flat=True)
            if path
        )
    )


def _delete_issue_attachment_files(paths: list[str]) -> None:
    for path in paths:
        delete_media_path(path)


def create_issue_for_project(*, serializer, reporter, project):
    with transaction.atomic():
        issue = serializer.save(project=project, reporter=reporter)
        ensure_issue_assignees(issue=issue, user_ids=[reporter.id])
        _dispatch_issue_side_effects(
            issue=issue,
            actor=reporter,
            event_type=EventType.CREATE,
            message="Issue created",
            notification_sender=notify_issue_added,
            notification_users=_project_issue_admin_users(project=project),
            notification_actor=reporter,
        )
    return issue


def update_issue_from_serializer(*, serializer, actor, raw_message):
    with transaction.atomic():
        issue = serializer.save()
        message = (raw_message or "").strip() or "Issue updated"
        _dispatch_issue_side_effects(
            issue=issue,
            actor=actor,
            event_type=EventType.EDIT,
            message=message,
            notification_sender=notify_issue_updated,
            notification_users=_issue_update_recipients(issue=issue, actor=actor),
        )
    return issue


def delete_issue(*, instance: Issue, title_confirmation: str | None):
    if not title_confirmation:
        raise ValidationError({"title": "Issue title confirmation is required"})
    if title_confirmation != instance.title:
        raise ValidationError({"title": "Issue title confirmation mismatch"})

    attachment_paths = _issue_attachment_paths(issue=instance)

    with transaction.atomic():
        instance.delete()
        if attachment_paths:
            transaction.on_commit(partial(_delete_issue_attachment_files, attachment_paths))


def assign_issue_users(*, issue: Issue, actor, raw_user_ids):
    user_ids = request_user_ids(raw_user_ids)
    if not user_ids:
        raise ValidationError({"userIds": "At least one userId is required"})

    validate_issue_assignment_user_ids(project=issue.project, user_ids=user_ids)

    with transaction.atomic():
        assigned_users = add_issue_assignees(issue=issue, user_ids=user_ids)
        if not assigned_users:
            return

        _dispatch_issue_side_effects(
            issue=issue,
            actor=actor,
            event_type=EventType.ASSIGN,
            message="Assignees updated",
            notification_sender=notify_issue_assigned,
            notification_users=assigned_users,
        )


def unassign_issue_users(*, issue: Issue, actor, raw_user_ids):
    user_ids = request_user_ids(raw_user_ids)
    if not user_ids:
        raise ValidationError({"userIds": "At least one userId is required"})

    with transaction.atomic():
        users = remove_existing_issue_assignees(issue=issue, user_ids=user_ids)
        if not users:
            return

        active_users = [user for user in users if user.is_active]
        _dispatch_issue_side_effects(
            issue=issue,
            actor=actor,
            event_type=EventType.UNASSIGN,
            message="Assignees removed",
            notification_sender=notify_issue_unassigned,
            notification_users=active_users,
        )


def _validate_issue_status_transition(*, issue: Issue, new_status: str) -> None:
    if new_status not in dict(IssueStatus.choices):
        raise ValidationError({"status": "Invalid status"})
    if issue.status in {IssueStatus.DONE, IssueStatus.CANCELLED} and new_status != issue.status:
        raise ValidationError({"status": "Closed issues cannot be reopened"})


def update_issue_status(*, issue: Issue, actor, new_status, raw_message, payload):
    _validate_issue_status_transition(issue=issue, new_status=new_status)
    old_status = issue.status
    if new_status == old_status:
        return issue

    with transaction.atomic():
        issue.status = new_status
        issue.save(update_fields=["status"])

        _dispatch_issue_side_effects(
            issue=issue,
            actor=actor,
            event_type=EventType.STATUS_CHANGE,
            message=raw_message,
            payload=payload,
            old_status=old_status,
            new_status=new_status,
            notification_sender=notify_issue_closed if new_status == IssueStatus.DONE else None,
            notification_users=[issue.reporter] if new_status == IssueStatus.DONE else None,
            notification_actor=actor if new_status == IssueStatus.DONE else _UNSET,
        )
    return issue


def create_issue_comment(*, issue: Issue, actor, raw_message, payload):
    message = validate_issue_event_message(
        raw_message,
        required=True,
        strip=True,
    )
    with transaction.atomic():
        event = _dispatch_issue_side_effects(
            issue=issue,
            actor=actor,
            event_type=EventType.COMMENT,
            message=message,
            payload=payload,
            notification_sender=notify_issue_updated,
            notification_users=_issue_update_recipients(issue=issue, actor=actor),
        )
    return event


def upload_attachment_for_event(*, event: IssueEvent, payload):
    attachments = create_attachment_for_event(
        event,
        payload,
        required=True,
        max_files=1,
    )
    schedule_issue_event_broadcast(event)
    return attachments[0]


def create_issue_attachment(*, issue: Issue, actor, payload):
    message = (payload.get("message", "") or "").strip() or "Attachment uploaded"
    event = create_issue_event_with_attachment(
        issue=issue,
        actor=actor,
        event_type=EventType.COMMENT,
        message=message,
        payload=payload,
        attachments_required=True,
        max_files=1,
    )
    attachment = event.attachments.first()
    return attachment
