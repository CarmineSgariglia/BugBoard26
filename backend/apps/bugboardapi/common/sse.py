"""Server-sent events helpers shared across streaming endpoints."""
from __future__ import annotations

import json

from rest_framework.renderers import BaseRenderer


class ServerSentEventsRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "event-stream"
    charset = None
    render_style = "binary"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode("utf-8")
        return json.dumps(data).encode("utf-8")


def format_sse_event(*, event: str, data: object | None = None, event_id: int | None = None) -> str:
    lines: list[str] = [f"event: {event}"]
    if event_id is not None:
        lines.append(f"id: {event_id}")
    if data is not None:
        payload = data if isinstance(data, str) else json.dumps(data)
        for line in payload.splitlines() or [""]:
            lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"
