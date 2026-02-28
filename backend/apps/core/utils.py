"""Utility helpers shared across the core app."""
from __future__ import annotations

from rest_framework import serializers


def build_media_url(serializer: serializers.Serializer, path_or_url: str) -> str:
    """Return an absolute media URL for a stored path."""
    if not path_or_url:
        return ""
    if path_or_url.startswith(("http://", "https://", "/media/")):
        return path_or_url
    return f"/media/{path_or_url}".replace("//", "/")
