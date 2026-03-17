import logging
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from ...security.uploads import store_upload, validate_issue_attachment
from .media import transcode_video_upload
from .models import Attachment, IssueEvent
from .realtime import publish_issue_event_created
from .serializers import IssueEventSerializer

logger = logging.getLogger(__name__)

ISSUE_EVENT_MESSAGE_MAX_LEN = 1000


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


def build_attachment_display_name(raw_name: str, final_suffix: str) -> str:
    normalized_name = PurePosixPath((raw_name or "").replace("\\", "/")).name
    base_name = Path(normalized_name).stem.strip() if normalized_name else ""
    safe_suffix = final_suffix if final_suffix.startswith(".") else f".{final_suffix}" if final_suffix else ""

    if not base_name:
        base_name = "attachment"

    return f"{base_name}{safe_suffix}"


def save_issue_uploaded_file(*, uploaded_file, issue_id: int, base_dir: str):
    content_type, size = validate_issue_attachment(
        uploaded_file,
        max_size_bytes=getattr(settings, "BUGBOARD_MAX_ATTACHMENT_FILE_BYTES", 10 * 1024 * 1024),
    )
    if content_type.startswith("video/"):
        if size > getattr(settings, "BUGBOARD_MAX_ATTACHMENT_VIDEO_BYTES", 50 * 1024 * 1024):
            raise ValidationError({"file": "Max video size is 50MB"})
        result = transcode_video_upload(
            uploaded_file=uploaded_file,
            storage_dir=f"{base_dir}/{issue_id}",
        )
        original_name = build_attachment_display_name(
            getattr(uploaded_file, "name", ""),
            Path(result.path).suffix.lower() or ".mp4",
        )
        return result.path, result.mime_type, result.size, original_name

    suffix = Path(getattr(uploaded_file, "name", "")).suffix.lower()
    saved = store_upload(
        uploaded_file=uploaded_file,
        storage_dir=f"{base_dir}/{issue_id}",
        filename_suffix=suffix,
    )
    original_name = build_attachment_display_name(
        getattr(uploaded_file, "name", ""),
        suffix or Path(saved.path).suffix.lower(),
    )
    return saved.path, content_type, size, original_name


def create_attachment_for_event(event: IssueEvent, payload: dict):
    uploaded_files = payload.getlist("file") if hasattr(payload, "getlist") else payload.get("file")
    if not uploaded_files:
        return []

    if not isinstance(uploaded_files, list):
        uploaded_files = [uploaded_files]

    if len(uploaded_files) > 10:
        raise ValidationError({"file": "Maximum 10 files allowed per comment."})

    attachments = []
    for uploaded_file in uploaded_files:
        saved_path, mime_type, size, original_name = save_issue_uploaded_file(
            uploaded_file=uploaded_file,
            issue_id=event.issue_id,
            base_dir="issue-attachments",
        )
        attachment = Attachment.objects.create(
            update=event,
            original_name=original_name,
            path=saved_path,
            mime_type=mime_type,
            size=size,
        )
        attachments.append(attachment)

    return attachments


def schedule_issue_event_broadcast(event: IssueEvent) -> None:
    def broadcast_issue_event() -> None:
        persisted_event = (
            IssueEvent.objects.select_related("issue", "actor", "actor__profile")
            .prefetch_related("attachments")
            .get(update_id=event.update_id)
        )
        payload = IssueEventSerializer(persisted_event).data
        publish_issue_event_created(persisted_event.issue_id, payload)

    transaction.on_commit(broadcast_issue_event)


def create_issue_event(
    *,
    issue,
    actor,
    event_type,
    message,
    **extra_fields,
) -> IssueEvent:
    event = IssueEvent.objects.create(
        issue=issue,
        actor=actor,
        event_type=event_type,
        message=message,
        **extra_fields,
    )
    schedule_issue_event_broadcast(event)
    return event


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
        event = create_issue_event(
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


def issue_notification_recipients(*, issue, actor) -> list[User]:
    return list(
        User.objects.filter(
            Q(issue_assignments__issue=issue) | Q(id=issue.reporter_id)
        )
        .filter(is_active=True)
        .exclude(id=getattr(actor, "id", None))
        .distinct()
    )
