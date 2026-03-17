from django.contrib.auth.models import User
from django.db.models import Count, Q
from rest_framework.exceptions import ValidationError

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
from ..notifications.models import NotifyType
from ..notifications.services import notify_users
from ..projects.models import ProjectMembership
from ..projects.serializers import ProjectMembershipSerializer
from .activity import (
    create_attachment_for_event,
    create_issue_event,
    create_issue_event_with_attachment,
    issue_notification_recipients,
    schedule_issue_event_broadcast,
    validate_issue_event_message,
)
from .models import EventType, Issue, IssueAssignee, IssueEvent, IssueStatus
from .serializers import AttachmentSerializer, IssueEventSerializer, IssueSerializer


def create_issue_for_project(*, request, project):
    serializer = IssueSerializer(data=request.data, context={"request": request, "project": project})
    serializer.is_valid(raise_exception=True)

    issue = serializer.save(project=project, reporter=request.user)
    IssueAssignee.objects.get_or_create(issue=issue, user=request.user)
    create_issue_event(issue=issue, actor=request.user, event_type=EventType.CREATE, message="Issue created")

    project_members = User.objects.filter(
        project_memberships__project=project,
        is_active=True,
    ).distinct()
    admins = [user for user in project_members if is_admin_user(user)]
    notify_users(notify_type=NotifyType.ISSUE_ADDED, users=list(admins), issue=issue)
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
        notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=issue)
    return issue


def delete_issue(*, instance: Issue, title_confirmation: str | None):
    if not title_confirmation:
        raise ValidationError({"title": "Issue title confirmation is required"})
    if title_confirmation != instance.title:
        raise ValidationError({"title": "Issue title confirmation mismatch"})

    recipients = list(User.objects.filter(issue_assignments__issue=instance).distinct())
    if recipients:
        notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=instance)
    instance.delete()


def assign_issue_users(*, issue: Issue, actor, raw_user_ids):
    user_ids = request_user_ids(raw_user_ids)
    if not user_ids:
        raise ValidationError({"userIds": "At least one userId is required"})

    memberships = list(
        ProjectMembership.objects.filter(project=issue.project, user_id__in=user_ids).select_related("user")
    )
    allowed_ids = {membership.user_id for membership in memberships}
    disallowed_ids = [uid for uid in user_ids if uid not in allowed_ids]
    if disallowed_ids:
        raise ValidationError({"userIds": f"Users must be members of project: {disallowed_ids}"})

    admin_ids = [membership.user_id for membership in memberships if is_admin_user(membership.user)]
    if admin_ids:
        raise ValidationError({"userIds": f"Admin users cannot be assigned to issues: {admin_ids}"})

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
    notify_users(notify_type=NotifyType.ISSUE_ASSIGNED, users=assigned_users, issue=issue)


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
        notify_users(notify_type=NotifyType.ISSUE_UNASSIGNED, users=users, issue=issue)


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
        notify_users(notify_type=NotifyType.ISSUE_CLOSED, users=[issue.reporter], issue=issue)
    return IssueSerializer(issue).data


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
        notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=issue)
    return IssueEventSerializer(event).data


def build_issue_suggestions_payload(*, issue: Issue):
    memberships_qs = (
        ProjectMembership.objects.filter(project=issue.project, user__is_active=True)
        .select_related("user", "user__profile")
        .annotate(
            open_count=Count(
                "user__issue_assignments",
                filter=Q(
                    user__issue_assignments__issue__status__in=[
                        IssueStatus.TODO,
                        IssueStatus.IN_PROGRESS,
                    ]
                ),
                distinct=True,
            )
        )
        .order_by("open_count", "user__username")
    )

    memberships = [membership for membership in memberships_qs if not is_admin_user(membership.user)]
    payload = ProjectMembershipSerializer(memberships, many=True).data
    open_count_by_user_id = {membership.user_id: membership.open_count for membership in memberships}
    for item in payload:
        item["openCount"] = open_count_by_user_id.get(item["userId"], 0)
    return payload


def upload_attachment_for_event(*, event: IssueEvent, payload):
    attachments = create_attachment_for_event(event, payload)
    if not attachments:
        raise ValidationError({"file": "Attachment file is required"})
    schedule_issue_event_broadcast(event)
    created_attachment = attachments[0] if isinstance(attachments, list) else attachments
    return AttachmentSerializer(created_attachment).data


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
    return AttachmentSerializer(attachment).data
