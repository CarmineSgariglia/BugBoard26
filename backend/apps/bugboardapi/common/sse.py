"""Server-sent events helpers shared across streaming endpoints."""
from __future__ import annotations

import json
from typing import Callable, Iterable, TypeVar

from django.http import StreamingHttpResponse

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


def parse_last_event_id(request) -> int:
    raw_last_event_id = request.headers.get("Last-Event-ID", "").strip()
    if not raw_last_event_id:
        return 0
    try:
        return max(int(raw_last_event_id), 0)
    except ValueError:
        return 0


T = TypeVar("T")


def stream_sse_events(
    *,
    catchup_items: Iterable[T],
    serialize_catchup_item: Callable[[T], tuple[str, object, int]],
    subscription,
    last_seen_id: int,
    heartbeat_interval: float,
    on_disconnect: Callable[[], None] | None = None,
):
    current_last_seen = last_seen_id

    try:
        for item in catchup_items:
            event_name, payload, event_id = serialize_catchup_item(item)
            current_last_seen = event_id
            yield format_sse_event(
                event=event_name,
                data=payload,
                event_id=event_id,
            )

        while True:
            stream_event = subscription.get_message(timeout=heartbeat_interval)
            if stream_event is None:
                yield format_sse_event(event="ping", data={})
                continue

            if stream_event.event_id <= current_last_seen:
                continue

            current_last_seen = stream_event.event_id
            yield format_sse_event(
                event=stream_event.event,
                data=stream_event.data,
                event_id=stream_event.event_id,
            )
    except GeneratorExit:
        if on_disconnect is not None:
            on_disconnect()
    finally:
        subscription.close()


def build_sse_response(streaming_content) -> StreamingHttpResponse:
    response = StreamingHttpResponse(
        streaming_content,
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
