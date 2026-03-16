from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.conf import settings
from django.core.files.base import File
from rest_framework.exceptions import ValidationError

from ...security.uploads import store_upload


@dataclass(frozen=True)
class MediaUploadResult:
    path: str
    mime_type: str
    size: int


def transcode_video_upload(*, uploaded_file, storage_dir: str) -> MediaUploadResult:
    input_suffix = Path(getattr(uploaded_file, "name", "")).suffix.lower() or ".bin"
    input_path: str | None = None
    output_path: str | None = None

    try:
        with NamedTemporaryFile(delete=False, suffix=input_suffix) as source:
            input_path = source.name
            for chunk in uploaded_file.chunks():
                source.write(chunk)

        with NamedTemporaryFile(delete=False, suffix=".mp4") as target:
            output_path = target.name

        command = [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-vf",
            "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "28",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-map_metadata",
            "-1",
            output_path,
        ]
        subprocess.run(command, check=True, capture_output=True, text=True)

        output_size = Path(output_path).stat().st_size
        max_video_size = getattr(settings, "BUGBOARD_VIDEO_OUTPUT_MAX_BYTES", 50 * 1024 * 1024)
        if output_size <= 0:
            raise ValidationError({"file": "Compressed video is empty"})
        if output_size > max_video_size:
            raise ValidationError({"file": "Compressed video exceeds the 50MB limit"})

        with open(output_path, "rb") as transcoded_handle:
            saved = store_upload(
                uploaded_file=File(transcoded_handle, name="video.mp4"),
                storage_dir=storage_dir,
                filename_suffix=".mp4",
            )
        return MediaUploadResult(path=saved.path, mime_type="video/mp4", size=output_size)
    except FileNotFoundError as exc:
        raise ValidationError({"file": "Video compression backend is not available"}) from exc
    except subprocess.CalledProcessError as exc:
        raise ValidationError({"file": "Video file is invalid or could not be compressed"}) from exc
    finally:
        for temp_path in (input_path, output_path):
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
