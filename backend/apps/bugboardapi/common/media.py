"""Utility helpers shared across the core app."""
from __future__ import annotations

from urllib.parse import urljoin

from django.conf import settings


def build_media_url(path_or_url: str) -> str:
    """Return an absolute media URL for a stored path or trusted HTTPS URL."""
    if not path_or_url:
        return ""
    if path_or_url.startswith(("http://", "https://")):
        return path_or_url
    if "://" in path_or_url:
        return ""
    if path_or_url.startswith("/media/"):
        return path_or_url
    media_base = settings.MEDIA_URL or "/media/"
    if not media_base.endswith("/"):
        media_base = f"{media_base}/"
    normalized = path_or_url.lstrip("/")
    if normalized.startswith("media/"):
        normalized = normalized.removeprefix("media/")
    return urljoin(media_base, normalized)
