"""Shared view helpers — access checks, filter utilities, and small functions."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied, ValidationError

from ..models import (
    Attachment,
    IssueEvent,
    Project,
    ProjectMembership,
)
from ..permissions import is_admin

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Access helpers
# ---------------------------------------------------------------------------

def check_admin(user: User) -> None:
    """Raise ``PermissionDenied`` unless *user* is an admin."""
    if not is_admin(user):
        raise PermissionDenied("Admin privileges required")


def user_project_ids(user: User):
    """Return a queryset of project IDs the *user* can access."""
    if is_admin(user):
        return Project.objects.values_list("project_id", flat=True)
    return ProjectMembership.objects.filter(user=user).values_list("project_id", flat=True)


def ensure_project_access(user: User, project: Project) -> None:
    if is_admin(user):
        return
    if not ProjectMembership.objects.filter(project=project, user=user).exists():
        raise PermissionDenied("You do not have access to this project")


def ensure_issue_access(user, issue):
    ensure_project_access(user, issue.project)


# ---------------------------------------------------------------------------
# Filter & parse helpers
# ---------------------------------------------------------------------------

def parse_int_or_none(raw_value):
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


MAX_USER_IDS = 100


def request_user_ids(raw_value):
    """Parse a list of user IDs from request data with basic validation."""
    if isinstance(raw_value, list):
        if len(raw_value) > MAX_USER_IDS:
            raise ValidationError({"userIds": f"Maximum {MAX_USER_IDS} user IDs allowed"})
        try:
            return [int(v) for v in raw_value]
        except (TypeError, ValueError):
            raise ValidationError({"userIds": "All values must be valid integers"})
    if raw_value in (None, ""):
        return []
    try:
        return [int(raw_value)]
    except (TypeError, ValueError):
        raise ValidationError({"userIds": "Value must be a valid integer"})


def apply_issue_filters(queryset, request):
    q = request.query_params.get("q")
    category = request.query_params.get("category")
    priority = request.query_params.get("priority")
    tag = request.query_params.get("tag")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if q:
        queryset = queryset.filter(title__icontains=q)
    if category:
        queryset = queryset.filter(issue_type=category)
    if priority:
        queryset = queryset.filter(priority=priority)
    if tag:
        queryset = queryset.filter(tags__name__iexact=tag)
    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)
    return queryset.distinct()


def maybe_create_attachment(event: IssueEvent, payload: dict):
    path = payload.get("path")
    if not path:
        return None
    mime_type = payload.get("mimeType", "application/octet-stream")
    size = int(payload.get("size", 0))
    return Attachment.objects.create(update=event, path=path, mime_type=mime_type, size=size)


def create_issue_for_project(*, request, project):
    """Validate and create an issue within the given project."""
    from ..serializers import IssueSerializer
    from ..services import notify_users

    serializer = IssueSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    assignee_ids = serializer.validated_data.get("assigneeIds", [])
    if assignee_ids:
        member_ids = set(
            ProjectMembership.objects.filter(project=project, user_id__in=assignee_ids).values_list("user_id", flat=True)
        )
        invalid_ids = [user_id for user_id in assignee_ids if user_id not in member_ids]
        if invalid_ids:
            raise ValidationError({"assigneeIds": f"Users must be members of project: {invalid_ids}"})

    tag_ids = serializer.validated_data.get("tagIds", [])
    if tag_ids:
        from ..models import Tag as TagModel
        existing_tag_ids = set(TagModel.objects.filter(tag_id__in=tag_ids).values_list("tag_id", flat=True))
        missing_tag_ids = [tag_id for tag_id in tag_ids if tag_id not in existing_tag_ids]
        if missing_tag_ids:
            raise ValidationError({"tagIds": f"Invalid tag ids: {missing_tag_ids}"})

    from ..models import EventType, NotifyType
    from django.contrib.auth.models import User

    issue = serializer.save(project=project, reporter=request.user)
    IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.CREATE, message="Issue created")

    admins = User.objects.filter(
        project_memberships__project=project,
        project_memberships__role=ProjectMembership.Role.ADMIN,
        is_active=True,
    )
    notify_users(notify_type=NotifyType.ISSUE_ADDED, users=list(admins), issue=issue)
    return issue
