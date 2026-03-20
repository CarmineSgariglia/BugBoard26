import logging
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ...roles import is_admin_user
from ...security.uploads import compress_image_upload, store_upload, validate_issue_attachment
from .membership import developer_issue_assignee_users, effective_admin_issue_subscription_users
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
    safe_suffix = final_suffix or ""
    if safe_suffix and not safe_suffix.startswith("."):
        safe_suffix = f".{safe_suffix}"

    if not base_name:
        base_name = "attachment"

    return f"{base_name}{safe_suffix}"


def save_issue_uploaded_file(*, uploaded_file, issue_id: int, base_dir: str):
    content_type, size = validate_issue_attachment(
        uploaded_file,
        max_size_bytes=getattr(settings, "BUGBOARD_MAX_ATTACHMENT_FILE_BYTES", 10 * 1024 * 1024),
        max_image_size_bytes=getattr(settings, "BUGBOARD_MAX_ATTACHMENT_IMAGE_BYTES", 10 * 1024 * 1024),
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

    if content_type.startswith("image/"):
        prepared_image = compress_image_upload(
            uploaded_file=uploaded_file,
            max_width=1600,
            max_height=1600,
            target_max_bytes=getattr(settings, "BUGBOARD_MAX_ATTACHMENT_IMAGE_BYTES", 10 * 1024 * 1024),
            field_name="file",
        )
        saved = store_upload(
            uploaded_file=prepared_image.file,
            storage_dir=f"{base_dir}/{issue_id}",
            filename_suffix=prepared_image.extension,
        )
        original_name = build_attachment_display_name(
            getattr(uploaded_file, "name", ""),
            prepared_image.extension,
        )
        return saved.path, prepared_image.mime_type, prepared_image.size, original_name

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


def extract_issue_uploaded_files(
    payload: dict,
    *,
    required: bool = False,
    max_files: int = 10,
):
    uploaded_files = payload.getlist("file") if hasattr(payload, "getlist") else payload.get("file")
    if not uploaded_files:
        if required:
            raise ValidationError({"file": "Attachment file is required"})
        return []

    if not isinstance(uploaded_files, list):
        uploaded_files = [uploaded_files]

    if len(uploaded_files) > max_files:
        if max_files == 1:
            raise ValidationError({"file": "Exactly one attachment file is required"})
        raise ValidationError({"file": f"Maximum {max_files} files allowed per comment."})

    return uploaded_files


def _create_attachments_for_event_from_files(event: IssueEvent, uploaded_files: list):
    if not uploaded_files:
        return []

    attachments = []
    saved_paths: list[str] = []
    try:
        with transaction.atomic():
            for uploaded_file in uploaded_files:
                saved_path, mime_type, size, original_name = save_issue_uploaded_file(
                    uploaded_file=uploaded_file,
                    issue_id=event.issue_id,
                    base_dir="issue-attachments",
                )
                saved_paths.append(saved_path)
                attachment = Attachment.objects.create(
                    update=event,
                    original_name=original_name,
                    path=saved_path,
                    mime_type=mime_type,
                    size=size,
                )
                attachments.append(attachment)
    except Exception:
        for saved_path in saved_paths:
            delete_media_path(saved_path)
        raise

    return attachments


def create_attachment_for_event(
    event: IssueEvent,
    payload: dict,
    *,
    required: bool = False,
    max_files: int = 10,
):
    uploaded_files = extract_issue_uploaded_files(
        payload,
        required=required,
        max_files=max_files,
    )
    return _create_attachments_for_event_from_files(event, uploaded_files)


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
    attachments_required: bool = False,
    max_files: int = 10,
    **extra_fields,
):
    message = validate_issue_event_message(message)
    uploaded_files = extract_issue_uploaded_files(
        payload,
        required=attachments_required,
        max_files=max_files,
    )
    with transaction.atomic():
        event = create_issue_event(
            issue=issue,
            actor=actor,
            event_type=event_type,
            message=message,
            **extra_fields,
        )
        _create_attachments_for_event_from_files(event, uploaded_files)
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
    actor_id = getattr(actor, "id", None)
    recipient_by_id: dict[int, User] = {}

    reporter = getattr(issue, "reporter", None)
    if reporter and reporter.is_active and not is_admin_user(reporter):
        recipient_by_id[reporter.id] = reporter

    for user in developer_issue_assignee_users(issue=issue, active_only=True):
        recipient_by_id[user.id] = user

    for user in effective_admin_issue_subscription_users(issue=issue, active_only=True):
        recipient_by_id[user.id] = user

    if actor_id is not None:
        recipient_by_id.pop(actor_id, None)

    return list(recipient_by_id.values())
