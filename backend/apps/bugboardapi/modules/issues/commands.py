from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
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
    issue_notification_recipients,
    schedule_issue_event_broadcast,
    validate_issue_event_message,
)
from .models import EventType, Issue, IssueAssignee, IssueEvent, IssueStatus
from .rules import validate_issue_assignment_user_ids


def create_issue_for_project(*, serializer, reporter, project):
    issue = serializer.save(project=project, reporter=reporter)
    IssueAssignee.objects.get_or_create(issue=issue, user=reporter)
    create_issue_event(issue=issue, actor=reporter, event_type=EventType.CREATE, message="Issue created")

    project_members = User.objects.filter(
        project_memberships__project=project,
        is_active=True,
    ).distinct()
    admins = [user for user in project_members if is_admin_user(user)]
    notify_issue_added(users=list(admins), actor=reporter, issue=issue)
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

    recipients = issue_notification_recipients(issue=issue, actor=actor)
    if recipients:
        notify_issue_updated(users=recipients, issue=issue)
    return issue


def delete_issue(*, instance: Issue, title_confirmation: str | None):
    if not title_confirmation:
        raise ValidationError({"title": "Issue title confirmation is required"})
    if title_confirmation != instance.title:
        raise ValidationError({"title": "Issue title confirmation mismatch"})

    recipients = list(User.objects.filter(issue_assignments__issue=instance).distinct())
    if recipients:
        notify_issue_updated(users=recipients, issue=instance)
    instance.delete()


def assign_issue_users(*, issue: Issue, actor, raw_user_ids):
    user_ids = request_user_ids(raw_user_ids)
    if not user_ids:
        raise ValidationError({"userIds": "At least one userId is required"})

    validate_issue_assignment_user_ids(project=issue.project, user_ids=user_ids)

    assigned_users = []
    for user_id in user_ids:
        assignment, _ = IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
        assigned_users.append(assignment.user)

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

    users = list(User.objects.filter(id__in=user_ids))
    IssueAssignee.objects.filter(issue=issue, user_id__in=user_ids).delete()
    create_issue_event(
        issue=issue,
        actor=actor,
        event_type=EventType.UNASSIGN,
        message="Assignees removed",
    )
    if users:
        notify_issue_unassigned(users=users, issue=issue)


def update_issue_status(*, issue: Issue, actor, new_status, raw_message, payload):
    if new_status not in dict(IssueStatus.choices):
        raise ValidationError({"status": "Invalid status"})

    old_status = issue.status
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

    recipients = issue_notification_recipients(issue=issue, actor=actor)
    if recipients:
        notify_issue_updated(users=recipients, issue=issue)
    return event


def upload_attachment_for_event(*, event: IssueEvent, payload):
    attachments = create_attachment_for_event(event, payload)
    if not attachments:
        raise ValidationError({"file": "Attachment file is required"})
    schedule_issue_event_broadcast(event)
    created_attachment = attachments[0] if isinstance(attachments, list) else attachments
    return created_attachment


def create_issue_attachment(*, issue: Issue, actor, payload):
    message = (payload.get("message", "") or "").strip() or "Attachment uploaded"
    event = create_issue_event_with_attachment(
        issue=issue,
        actor=actor,
        event_type=EventType.COMMENT,
        message=message,
        payload=payload,
    )
    attachment = event.attachments.first()
    if not attachment:
        raise ValidationError({"file": "Attachment file is required"})
    return attachment
