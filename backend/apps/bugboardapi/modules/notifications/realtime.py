from __future__ import annotations

import queue
import threading
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

_memory_lock = threading.Lock()
_memory_subscribers: dict[int, list[queue.Queue["NotificationEvent"]]] = defaultdict(list)


@dataclass(slots=True)
class NotificationEvent:
    event: str
    event_id: int
    data: dict[str, Any]


class NotificationSubscription:
    def get_message(self, timeout: float | None = None) -> NotificationEvent | None:
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError


class MemoryNotificationSubscription(NotificationSubscription):
    def __init__(self, *, user_id: int, events: queue.Queue[NotificationEvent]) -> None:
        self._user_id = user_id
        self._events = events

    def get_message(self, timeout: float | None = None) -> NotificationEvent | None:
        try:
            return self._events.get(timeout=timeout)
        except queue.Empty:
            return None

    def close(self) -> None:
        with _memory_lock:
            queues = _memory_subscribers.get(self._user_id)
            if not queues:
                return
            _memory_subscribers[self._user_id] = [item for item in queues if item is not self._events]
            if not _memory_subscribers[self._user_id]:
                _memory_subscribers.pop(self._user_id, None)


def publish_notification_created(user_id: int, notification: dict[str, Any]) -> None:
    event = NotificationEvent(
        event="notification.created",
        event_id=int(notification["notifyUserId"]),
        data=notification,
    )

    with _memory_lock:
        subscribers = list(_memory_subscribers.get(user_id, []))
    for subscriber in subscribers:
        subscriber.put(event)


def open_notification_subscription(user_id: int) -> NotificationSubscription:
    events: queue.Queue[NotificationEvent] = queue.Queue()
    with _memory_lock:
        _memory_subscribers[user_id].append(events)
    return MemoryNotificationSubscription(user_id=user_id, events=events)
