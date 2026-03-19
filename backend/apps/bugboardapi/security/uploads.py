"""Centralized upload validation and storage helpers."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

IMAGE_SIGNATURES: dict[str, bytes] = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/webp": b"RIFF",
}
JPEG_SIGNATURE = b"\xff\xd8\xff"
WEBM_SIGNATURE = b"\x1A\x45\xDF\xA3"
FTYP_MARKER = b"ftyp"

ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

ALLOWED_VIDEO_TYPES: dict[str, set[str]] = {
    "video/mp4": {".mp4", ".m4v"},
    "video/quicktime": {".mov"},
    "video/webm": {".webm"},
}

ALLOWED_ATTACHMENT_TYPES: dict[str, set[str]] = {
    "text/plain": {".txt", ".log", ".md"},
    "text/csv": {".csv"},
    "application/json": {".json"},
    "application/pdf": {".pdf"},
    "application/zip": {".zip"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    **ALLOWED_VIDEO_TYPES,
}


@dataclass(frozen=True)
class StoredUpload:
    path: str
    mime_type: str
    size: int


@dataclass(frozen=True)
class PreparedImageUpload:
    file: ContentFile
    mime_type: str
    size: int
    extension: str


COMPRESSED_IMAGE_MIME_TYPE = "image/webp"
COMPRESSED_IMAGE_EXTENSION = ".webp"
IMAGE_QUALITY_STEPS = (82, 74, 66, 58, 50)
IMAGE_SCALE_STEPS = (1.0, 0.85, 0.72, 0.6)


def _read_prefix(uploaded_file, size: int = 16) -> bytes:
    position = uploaded_file.tell() if hasattr(uploaded_file, "tell") else None
    prefix = uploaded_file.read(size)
    if position is not None and hasattr(uploaded_file, "seek"):
        uploaded_file.seek(position)
    return prefix


def _ensure_image_signature(content_type: str, uploaded_file) -> None:
    prefix = _read_prefix(uploaded_file)
    if content_type == "image/jpeg":
        if not prefix.startswith(JPEG_SIGNATURE):
            raise ValidationError({"image": "File content does not match JPEG format"})
        return
    if content_type == "image/webp":
        if not (prefix.startswith(b"RIFF") and prefix[8:12] == b"WEBP"):
            raise ValidationError({"image": "File content does not match WEBP format"})
        return
    signature = IMAGE_SIGNATURES.get(content_type)
    if signature and not prefix.startswith(signature):
        raise ValidationError({"image": f"File content does not match {content_type} format"})


def _ensure_video_signature(content_type: str, uploaded_file) -> None:
    prefix = _read_prefix(uploaded_file, size=32)
    if content_type == "video/webm":
        if not prefix.startswith(WEBM_SIGNATURE):
            raise ValidationError({"file": "File content does not match WEBM format"})
        return

    if content_type in {"video/mp4", "video/quicktime"}:
        if len(prefix) < 12 or prefix[4:8] != FTYP_MARKER:
            raise ValidationError({"file": "File content does not match MP4/MOV format"})


def validate_profile_image(uploaded_file, *, max_size_bytes: int = 2 * 1024 * 1024) -> tuple[str, int]:
    size = int(getattr(uploaded_file, "size", 0) or 0)
    if size <= 0:
        raise ValidationError({"image": "Image file is empty"})
    if size > max_size_bytes:
        raise ValidationError({"image": "Max image size is 2MB"})

    content_type = (getattr(uploaded_file, "content_type", "") or "").strip().lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError({"image": "Allowed formats: JPEG, PNG, WEBP"})

    suffix = Path(getattr(uploaded_file, "name", "")).suffix.lower()
    expected_suffix = ALLOWED_IMAGE_TYPES[content_type]
    if suffix and suffix not in {expected_suffix, ".jpeg" if expected_suffix == ".jpg" else expected_suffix}:
        raise ValidationError({"image": "File extension does not match image type"})

    _ensure_image_signature(content_type, uploaded_file)
    return expected_suffix.removeprefix("."), size


def _coerce_image_mode(image: Image.Image) -> Image.Image:
    if image.mode in {"RGB", "RGBA"}:
        return image
    if image.mode in {"LA", "PA"}:
        return image.convert("RGBA")
    if image.mode == "P":
        if "transparency" in image.info:
            return image.convert("RGBA")
        return image.convert("RGB")
    return image.convert("RGB")


def _resized_dimensions(
    width: int,
    height: int,
    *,
    max_width: int,
    max_height: int,
    scale_factor: float,
) -> tuple[int, int]:
    ratio = min(max_width / width, max_height / height, 1.0) * scale_factor
    safe_ratio = ratio if ratio > 0 else 1.0
    return (
        max(1, round(width * safe_ratio)),
        max(1, round(height * safe_ratio)),
    )


def _build_prepared_image_upload(*, payload: bytes, original_name: str) -> PreparedImageUpload:
    prepared = ContentFile(payload, name=f"{Path(original_name or 'upload').stem}{COMPRESSED_IMAGE_EXTENSION}")
    prepared.content_type = COMPRESSED_IMAGE_MIME_TYPE
    return PreparedImageUpload(
        file=prepared,
        mime_type=COMPRESSED_IMAGE_MIME_TYPE,
        size=len(payload),
        extension=COMPRESSED_IMAGE_EXTENSION,
    )


def compress_image_upload(
    *,
    uploaded_file,
    max_width: int,
    max_height: int,
    target_max_bytes: int,
    field_name: str,
) -> PreparedImageUpload:
    position = uploaded_file.tell() if hasattr(uploaded_file, "tell") else None
    try:
        image = Image.open(uploaded_file)
        image = ImageOps.exif_transpose(image)
        image.load()
    except (OSError, UnidentifiedImageError) as exc:
        raise ValidationError({field_name: "Image file is invalid or could not be processed"}) from exc
    finally:
        if position is not None and hasattr(uploaded_file, "seek"):
            uploaded_file.seek(position)

    image = _coerce_image_mode(image)
    for scale_factor in IMAGE_SCALE_STEPS:
        target_width, target_height = _resized_dimensions(
            image.width,
            image.height,
            max_width=max_width,
            max_height=max_height,
            scale_factor=scale_factor,
        )

        resized = image.copy()
        if resized.size != (target_width, target_height):
            resized = resized.resize((target_width, target_height), Image.Resampling.LANCZOS)

        for quality in IMAGE_QUALITY_STEPS:
            buffer = BytesIO()
            resized.save(buffer, format="WEBP", quality=quality, method=6)
            payload = buffer.getvalue()

            if len(payload) <= target_max_bytes:
                return _build_prepared_image_upload(
                    payload=payload,
                    original_name=getattr(uploaded_file, "name", "upload"),
                )

    raise ValidationError(
        {field_name: f"Image could not be compressed below {target_max_bytes // (1024 * 1024)}MB"}
    )


def validate_issue_attachment(
    uploaded_file,
    *,
    max_size_bytes: int = 10 * 1024 * 1024,
    max_image_size_bytes: int | None = None,
) -> tuple[str, int]:
    size = int(getattr(uploaded_file, "size", 0) or 0)
    if size <= 0:
        raise ValidationError({"file": "File is empty"})

    content_type = (getattr(uploaded_file, "content_type", "") or "").strip().lower()
    suffix = Path(getattr(uploaded_file, "name", "")).suffix.lower()
    allowed_suffixes = ALLOWED_ATTACHMENT_TYPES.get(content_type)
    if not allowed_suffixes:
        raise ValidationError({"file": "Unsupported attachment type"})
    if suffix not in allowed_suffixes:
        raise ValidationError({"file": "File extension does not match attachment type"})

    if content_type.startswith("image/"):
        image_size_limit = max_image_size_bytes or max_size_bytes
        if size > image_size_limit:
            raise ValidationError({"file": "Max image/file size is 10MB"})
        _ensure_image_signature(content_type, uploaded_file)
    elif content_type.startswith("video/"):
        _ensure_video_signature(content_type, uploaded_file)
    elif size > max_size_bytes:
        raise ValidationError({"file": "Max file size is 10MB"})

    return content_type, size


def store_upload(*, uploaded_file, storage_dir: str, filename_suffix: str) -> StoredUpload:
    filename = f"{uuid4().hex}{filename_suffix}"
    storage_path = f"{storage_dir}/{filename}"
    saved_path = default_storage.save(storage_path, uploaded_file)
    mime_type = (getattr(uploaded_file, "content_type", "") or "").strip().lower()
    size = int(getattr(uploaded_file, "size", 0) or 0)
    return StoredUpload(path=saved_path, mime_type=mime_type, size=size)
