import logging
from pathlib import Path

from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ..issue_rules import validate_project_assignee_ids
from ..models import Attachment, EventType, IssueAssignee, IssueEvent, NotifyType
from ..roles import is_admin_user
from ..upload_security import store_upload, validate_issue_attachment
from .notifications import notify_users

logger = logging.getLogger(__name__)

MAX_USER_IDS = 100
ISSUE_EVENT_MESSAGE_MAX_LEN = 1000


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


def validate_issue_event_message(
    message,
    *,
    required: bool = False,
    strip: bool = False,
):
    normalized = "" if message is None else str(message)
    if strip:
        normalized = normalized.strip()
    if required and not normalized:
        raise ValidationError({"message": "message is required"})
    if len(normalized) > ISSUE_EVENT_MESSAGE_MAX_LEN:
        raise ValidationError({"message": "Must be at most 1000 characters"})
    return normalized


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


def create_attachment_for_event(event: IssueEvent, payload: dict):
    # Depending on the payload (dict vs QueryDict), getlist or get provides the list of files
    uploaded_files = payload.getlist("file") if hasattr(payload, "getlist") else payload.get("file")
    if not uploaded_files:
        return []
    
    # If it's a single file, convert it to list
    if not isinstance(uploaded_files, list):
        uploaded_files = [uploaded_files]

    if len(uploaded_files) > 10:
        raise ValidationError({"file": "Maximum 10 files allowed per comment."})

    attachments = []
    for uploaded_file in uploaded_files:
        saved_path, mime_type, size = save_issue_uploaded_file(
            uploaded_file=uploaded_file,
            issue_id=event.issue_id,
            base_dir="issue-attachments",
        )
        att = Attachment.objects.create(update=event, path=saved_path, mime_type=mime_type, size=size)
        attachments.append(att)
        
    return attachments


def create_issue_event_with_attachment(
    *,
    issue,
    actor,
    event_type,
    message,
    payload: dict,
    **extra_fields,
):
    message = validate_issue_event_message(message)
    with transaction.atomic():
        event = IssueEvent.objects.create(
            issue=issue,
            actor=actor,
            event_type=event_type,
            message=message,
            **extra_fields,
        )
        create_attachment_for_event(event, payload)
    return event


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
    IssueAssignee.objects.get_or_create(issue=issue, user=request.user)
    IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.CREATE, message="Issue created")

    project_members = User.objects.filter(
        project_memberships__project=project,
        is_active=True,
    ).distinct()
    admins = [user for user in project_members if is_admin_user(user)]
    notify_users(notify_type=NotifyType.ISSUE_ADDED, users=list(admins), issue=issue)
    return issue
