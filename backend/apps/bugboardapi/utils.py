"""Utility helpers shared across the core app."""
from __future__ import annotations

from urllib.parse import urljoin

from django.conf import settings
from rest_framework import serializers


def build_media_url(serializer: serializers.Serializer, path_or_url: str) -> str:
    """Return an absolute media URL for a stored path."""
    if not path_or_url:
        return ""
    if path_or_url.startswith(("http://", "https://")):
        return path_or_url
    if path_or_url.startswith("/media/"):
        return path_or_url
    media_base = settings.MEDIA_URL or "/media/"
    if not media_base.endswith("/"):
        media_base = f"{media_base}/"
    normalized = path_or_url.lstrip("/")
    if normalized.startswith("media/"):
        normalized = normalized.removeprefix("media/")
    return urljoin(media_base, normalized)
