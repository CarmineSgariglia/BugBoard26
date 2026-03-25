from __future__ import annotations

import logging
import queue
import threading
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

_memory_lock = threading.Lock()
_memory_subscribers: dict[int, list[queue.Queue["IssueRealtimeEvent"]]] = defaultdict(list)


@dataclass(slots=True)
class IssueRealtimeEvent:
    event: str
    event_id: int
    data: dict[str, Any]


class IssueSubscription:
    def get_message(self, timeout: float | None = None) -> IssueRealtimeEvent | None:
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError


class MemoryIssueSubscription(IssueSubscription):
    def __init__(self, *, issue_id: int, events: queue.Queue[IssueRealtimeEvent]) -> None:
        self._issue_id = issue_id
        self._events = events

    def get_message(self, timeout: float | None = None) -> IssueRealtimeEvent | None:
        try:
            return self._events.get(timeout=timeout)
        except queue.Empty:
            return None

    def close(self) -> None:
        with _memory_lock:
            queues = _memory_subscribers.get(self._issue_id)
            if not queues:
                return
            _memory_subscribers[self._issue_id] = [item for item in queues if item is not self._events]
            if not _memory_subscribers[self._issue_id]:
                _memory_subscribers.pop(self._issue_id, None)


def publish_issue_event_created(issue_id: int, event_payload: dict[str, Any]) -> None:
    realtime_event = IssueRealtimeEvent(
        event="issue.event.created",
        event_id=int(event_payload["updateId"]),
        data=event_payload,
    )

    with _memory_lock:
        subscribers = list(_memory_subscribers.get(issue_id, []))
    for subscriber in subscribers:
        subscriber.put(realtime_event)


def open_issue_subscription(issue_id: int) -> IssueSubscription:
    events: queue.Queue[IssueRealtimeEvent] = queue.Queue()
    with _memory_lock:
        _memory_subscribers[issue_id].append(events)
    return MemoryIssueSubscription(issue_id=issue_id, events=events)
