from __future__ import annotations

import queue
import threading
from collections import defaultdict
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class RealtimeEvent:
    event: str
    event_id: int
    data: dict[str, Any]


class RealtimeSubscription:
    def get_message(self, timeout: float | None = None) -> RealtimeEvent | None:
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError


class _MemoryRealtimeSubscription(RealtimeSubscription):
    def __init__(
        self,
        *,
        channel_id: int,
        events: queue.Queue[RealtimeEvent],
        hub: RealtimeEventHub,
    ) -> None:
        self._channel_id = channel_id
        self._events = events
        self._hub = hub

    def get_message(self, timeout: float | None = None) -> RealtimeEvent | None:
        try:
            return self._events.get(timeout=timeout)
        except queue.Empty:
            return None

    def close(self) -> None:
        self._hub.remove_subscription(channel_id=self._channel_id, events=self._events)


class RealtimeEventHub:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: dict[int, list[queue.Queue[RealtimeEvent]]] = defaultdict(
            list
        )

    def open_subscription(self, channel_id: int) -> RealtimeSubscription:
        events: queue.Queue[RealtimeEvent] = queue.Queue()
        with self._lock:
            self._subscribers[channel_id].append(events)
        return _MemoryRealtimeSubscription(
            channel_id=channel_id, events=events, hub=self
        )

    def publish(
        self,
        channel_id: int,
        *,
        event: str,
        event_id: int,
        data: dict[str, Any],
    ) -> None:
        realtime_event = RealtimeEvent(event=event, event_id=event_id, data=data)
        with self._lock:
            subscribers = list(self._subscribers.get(channel_id, []))
        for subscriber in subscribers:
            subscriber.put(realtime_event)

    def remove_subscription(
        self,
        *,
        channel_id: int,
        events: queue.Queue[RealtimeEvent],
    ) -> None:
        with self._lock:
            subscribers = self._subscribers.get(channel_id)
            if not subscribers:
                return
            self._subscribers[channel_id] = [
                subscriber for subscriber in subscribers if subscriber is not events
            ]
            if not self._subscribers[channel_id]:
                self._subscribers.pop(channel_id, None)
