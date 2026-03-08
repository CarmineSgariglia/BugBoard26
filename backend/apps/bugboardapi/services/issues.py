import logging
from pathlib import Path

from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from rest_framework.exceptions import ValidationError

from ..issue_rules import validate_project_assignee_ids
from ..models import Attachment, EventType, IssueEvent, ProjectMembership, NotifyType
from ..upload_security import store_upload, validate_issue_attachment
from .notifications import notify_users

logger = logging.getLogger(__name__)

MAX_USER_IDS = 100


def parse_int_or_none(raw_value):
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


def request_user_ids(raw_value):
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


def save_issue_uploaded_file(*, uploaded_file, issue_id: int, base_dir: str):
    content_type, size = validate_issue_attachment(uploaded_file)
    suffix = Path(getattr(uploaded_file, "name", "")).suffix.lower()
    saved = store_upload(
        uploaded_file=uploaded_file,
        storage_dir=f"{base_dir}/{issue_id}",
        filename_suffix=suffix,
    )
    return saved.path, content_type, size


def maybe_create_attachment(event: IssueEvent, payload: dict):
    uploaded_file = payload.get("file")
    if uploaded_file is not None:
        saved_path, mime_type, size = save_issue_uploaded_file(
            uploaded_file=uploaded_file,
            issue_id=event.issue_id,
            base_dir="issue-attachments",
        )
        return Attachment.objects.create(update=event, path=saved_path, mime_type=mime_type, size=size)
    return None


def delete_media_path(path: str) -> None:
    if not path:
        return
    try:
        if default_storage.exists(path):
            default_storage.delete(path)
    except Exception:
        logger.warning("Failed to delete media file at path: %s", path)


def create_issue_for_project(*, request, project):
    from ..serializers import IssueSerializer

    serializer = IssueSerializer(data=request.data, context={"request": request, "project": project})
    serializer.is_valid(raise_exception=True)

    issue = serializer.save(project=project, reporter=request.user)
    IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.CREATE, message="Issue created")

    admins = User.objects.filter(
        project_memberships__project=project,
        project_memberships__role=ProjectMembership.Role.ADMIN,
        is_active=True,
    )
    notify_users(notify_type=NotifyType.ISSUE_ADDED, users=list(admins), issue=issue)
    return issue
