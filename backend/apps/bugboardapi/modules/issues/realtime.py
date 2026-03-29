from __future__ import annotations

from typing import Any

from ...common.realtime import RealtimeEvent, RealtimeEventHub, RealtimeSubscription

IssueRealtimeEvent = RealtimeEvent
IssueSubscription = RealtimeSubscription

_issue_event_hub = RealtimeEventHub()


def publish_issue_event_created(issue_id: int, event_payload: dict[str, Any]) -> None:
    _issue_event_hub.publish(
        channel_id=issue_id,
        event="issue.event.created",
        event_id=int(event_payload["updateId"]),
        data=event_payload,
    )


def open_issue_subscription(issue_id: int) -> IssueSubscription:
    return _issue_event_hub.open_subscription(channel_id=issue_id)
