from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
from .membership import effective_admin_issue_subscription_users
from ..projects.membership import admin_project_subscription_users
from ..notifications.services import (
    notify_issue_added,
    notify_issue_assigned,
    notify_issue_closed,
    notify_issue_unassigned,
    notify_issue_updated,
)
from .activity import (
    create_issue_event,
    create_issue_event_with_attachment,
    issue_notification_recipients,
    validate_issue_event_message,
)
from .models import EventType, Issue, IssueEvent, IssueStatus
from .mutations import add_issue_assignees, ensure_issue_assignees, remove_existing_issue_assignees
from .rules import validate_issue_assignment_user_ids

_UNSET = object()


def _issue_closed_recipients(*, issue: Issue) -> list[User]:
    return [issue.reporter, *admin_project_subscription_users(project=issue.project, active_only=True)]


def _merge_issue_notification_users(*, users: list[User], issue: Issue) -> list[User]:
    recipients_by_id = {user.id: user for user in users if getattr(user, "id", None) is not None}
    for user in effective_admin_issue_subscription_users(issue=issue, active_only=True):
        recipients_by_id[user.id] = user
    return list(recipients_by_id.values())


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


def create_issue_for_project(*, serializer, reporter, project):
    with transaction.atomic():
        issue = serializer.save(project=project, reporter=reporter)
        if not is_admin_user(reporter):
            ensure_issue_assignees(issue=issue, user_ids=[reporter.id])
        _dispatch_issue_side_effects(
            issue=issue,
            actor=reporter,
            event_type=EventType.CREATE,
            message="Issue created",
            notification_sender=notify_issue_added,
            notification_users=admin_project_subscription_users(project=project, active_only=True),
            notification_actor=reporter,
        )
    return issue


def update_issue_from_serializer(*, serializer, actor, raw_message):
    issue = serializer.instance
    old_status = issue.status
    requested_status = serializer.validated_data.get("status", old_status)
    normalized_message = validate_issue_event_message(raw_message, strip=True)
    _validate_issue_status_transition(issue=issue, new_status=requested_status)

    with transaction.atomic():
        issue = serializer.save()

        if issue.status != old_status:
            _dispatch_issue_side_effects(
                issue=issue,
                actor=actor,
                event_type=EventType.STATUS_CHANGE,
                message=normalized_message,
                old_status=old_status,
                new_status=issue.status,
                notification_sender=notify_issue_closed if issue.status == IssueStatus.DONE else notify_issue_updated,
                notification_users=(
                    _issue_closed_recipients(issue=issue)
                    if issue.status == IssueStatus.DONE
                    else issue_notification_recipients(issue=issue, actor=actor)
                ),
                notification_actor=actor if issue.status == IssueStatus.DONE else _UNSET,
            )
        else:
            message = normalized_message or "Issue updated"
            _dispatch_issue_side_effects(
                issue=issue,
                actor=actor,
                event_type=EventType.EDIT,
                message=message,
                notification_sender=notify_issue_updated,
                notification_users=issue_notification_recipients(issue=issue, actor=actor),
            )
    return issue

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
            notification_users=_merge_issue_notification_users(users=assigned_users, issue=issue),
            notification_actor=actor,
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
            notification_users=_merge_issue_notification_users(users=active_users, issue=issue),
            notification_actor=actor,
        )


def _validate_issue_status_transition(*, issue: Issue, new_status: str) -> None:
    if new_status not in dict(IssueStatus.choices):
        raise ValidationError({"status": "Invalid status"})


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
            notification_users=issue_notification_recipients(issue=issue, actor=actor),
        )
    return event
