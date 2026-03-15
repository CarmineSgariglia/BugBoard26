from __future__ import annotations

import json
import logging
import queue
import threading
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder

from redis import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

ISSUE_EVENT_CHANNEL = "issue-events:{issue_id}"

_memory_lock = threading.Lock()
_memory_subscribers: dict[int, list[queue.Queue["IssueRealtimeEvent"]]] = defaultdict(list)


def use_memory_transport() -> bool:
    backend = getattr(settings, "NOTIFICATIONS_TRANSPORT_BACKEND", "memory")
    return backend == "memory"


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


class RedisIssueSubscription(IssueSubscription):
    def __init__(self, *, pubsub, channel: str) -> None:
        self._pubsub = pubsub
        self._channel = channel

    def get_message(self, timeout: float | None = None) -> IssueRealtimeEvent | None:
        raw_message = self._pubsub.get_message(ignore_subscribe_messages=True, timeout=timeout)
        if raw_message is None or raw_message.get("type") != "message":
            return None

        raw_payload = raw_message.get("data")
        if isinstance(raw_payload, bytes):
            raw_payload = raw_payload.decode("utf-8")

        payload = json.loads(raw_payload)
        return IssueRealtimeEvent(
            event=payload["event"],
            event_id=int(payload["id"]),
            data=payload["data"],
        )

    def close(self) -> None:
        try:
            self._pubsub.unsubscribe(self._channel)
        except RedisError:
            logger.debug("issue_event_pubsub_unsubscribe_failed", exc_info=True)
        finally:
            self._pubsub.close()


@lru_cache(maxsize=1)
def _get_redis_client() -> Redis:
    return Redis.from_url(settings.NOTIFICATIONS_REDIS_URL)


def get_issue_event_channel(issue_id: int) -> str:
    return ISSUE_EVENT_CHANNEL.format(issue_id=issue_id)


def publish_issue_event_created(issue_id: int, event_payload: dict[str, Any]) -> None:
    realtime_event = IssueRealtimeEvent(
        event="issue.event.created",
        event_id=int(event_payload["updateId"]),
        data=event_payload,
    )

    if use_memory_transport():
        with _memory_lock:
            subscribers = list(_memory_subscribers.get(issue_id, []))
        for subscriber in subscribers:
            subscriber.put(realtime_event)
        return

    payload = json.dumps(
        {
            "event": realtime_event.event,
            "id": realtime_event.event_id,
            "data": realtime_event.data,
        },
        cls=DjangoJSONEncoder,
    )

    try:
        _get_redis_client().publish(get_issue_event_channel(issue_id), payload)
    except RedisError:
        logger.warning("issue_event_publish_failed", extra={"issue_id": issue_id}, exc_info=True)


def open_issue_subscription(issue_id: int) -> IssueSubscription:
    if use_memory_transport():
        events: queue.Queue[IssueRealtimeEvent] = queue.Queue()
        with _memory_lock:
            _memory_subscribers[issue_id].append(events)
        return MemoryIssueSubscription(issue_id=issue_id, events=events)

    try:
        pubsub = _get_redis_client().pubsub()
        channel = get_issue_event_channel(issue_id)
        pubsub.subscribe(channel)
    except RedisError as exc:
        logger.error("issue_event_subscription_failed", extra={"issue_id": issue_id}, exc_info=True)
        raise RuntimeError("Issue event stream transport unavailable") from exc

    return RedisIssueSubscription(pubsub=pubsub, channel=channel)
