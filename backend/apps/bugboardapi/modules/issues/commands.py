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
    recipients = issue_notification_recipients(issue=issue, actor=actor)
    return recipients


def _notify_issue_updated_recipients(*, issue: Issue, actor=None) -> None:
    recipients = _issue_update_recipients(issue=issue, actor=actor)
    if recipients:
        notify_issue_updated(users=recipients, issue=issue)


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
    issue = serializer.save(project=project, reporter=reporter)
    ensure_issue_assignees(issue=issue, user_ids=[reporter.id])
    create_issue_event(issue=issue, actor=reporter, event_type=EventType.CREATE, message="Issue created")

    admins = _project_issue_admin_users(project=project)
    notify_issue_added(users=admins, actor=reporter, issue=issue)
    return issue


def update_issue_from_serializer(*, serializer, actor, raw_message):
    issue = serializer.save()
    message = (raw_message or "").strip() or "Issue updated"
    create_issue_event(
        issue=issue,
        actor=actor,
        event_type=EventType.EDIT,
        message=message,
    )

    _notify_issue_updated_recipients(issue=issue, actor=actor)
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

        create_issue_event(
            issue=issue,
            actor=actor,
            event_type=EventType.ASSIGN,
            message="Assignees updated",
        )
        notify_issue_assigned(users=assigned_users, issue=issue)


def unassign_issue_users(*, issue: Issue, actor, raw_user_ids):
    user_ids = request_user_ids(raw_user_ids)
    if not user_ids:
        raise ValidationError({"userIds": "At least one userId is required"})

    with transaction.atomic():
        users = remove_existing_issue_assignees(issue=issue, user_ids=user_ids)
        if not users:
            return

        create_issue_event(
            issue=issue,
            actor=actor,
            event_type=EventType.UNASSIGN,
            message="Assignees removed",
        )
        active_users = [user for user in users if user.is_active]
        if active_users:
            notify_issue_unassigned(users=active_users, issue=issue)


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

        create_issue_event_with_attachment(
            issue=issue,
            actor=actor,
            event_type=EventType.STATUS_CHANGE,
            message=raw_message,
            payload=payload,
            old_status=old_status,
            new_status=new_status,
        )

        if new_status == IssueStatus.DONE:
            notify_issue_closed(users=[issue.reporter], actor=actor, issue=issue)
    return issue


def create_issue_comment(*, issue: Issue, actor, raw_message, payload):
    message = validate_issue_event_message(
        raw_message,
        required=True,
        strip=True,
    )
    event = create_issue_event_with_attachment(
        issue=issue,
        actor=actor,
        event_type=EventType.COMMENT,
        message=message,
        payload=payload,
    )

    _notify_issue_updated_recipients(issue=issue, actor=actor)
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
