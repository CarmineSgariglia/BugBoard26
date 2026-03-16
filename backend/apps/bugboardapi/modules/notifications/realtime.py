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
from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder

try:
    from redis import Redis
    from redis.exceptions import RedisError
except ModuleNotFoundError:  # pragma: no cover - depends on optional runtime dependency
    Redis = None

    class RedisError(Exception):
        """Fallback error type when redis-py is not installed."""

logger = logging.getLogger(__name__)

NOTIFICATION_LIST_CACHE_KEY = "notifications:list:{user_id}"
NOTIFICATION_CHANNEL = "notifications:user:{user_id}"

_memory_lock = threading.Lock()
_memory_subscribers: dict[int, list[queue.Queue["NotificationEvent"]]] = defaultdict(list)


def use_memory_transport() -> bool:
    backend = getattr(settings, "NOTIFICATIONS_TRANSPORT_BACKEND", "memory")
    return backend == "memory"


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


class RedisNotificationSubscription(NotificationSubscription):
    def __init__(self, *, pubsub, channel: str) -> None:
        self._pubsub = pubsub
        self._channel = channel

    def get_message(self, timeout: float | None = None) -> NotificationEvent | None:
        raw_message = self._pubsub.get_message(ignore_subscribe_messages=True, timeout=timeout)
        if raw_message is None or raw_message.get("type") != "message":
            return None

        raw_payload = raw_message.get("data")
        if isinstance(raw_payload, bytes):
            raw_payload = raw_payload.decode("utf-8")

        payload = json.loads(raw_payload)
        return NotificationEvent(
            event=payload["event"],
            event_id=int(payload["id"]),
            data=payload["data"],
        )

    def close(self) -> None:
        try:
            self._pubsub.unsubscribe(self._channel)
        except RedisError:
            logger.debug("notification_pubsub_unsubscribe_failed", exc_info=True)
        finally:
            self._pubsub.close()


@lru_cache(maxsize=1)
def _get_redis_client() -> Redis:
    if Redis is None:
        raise RuntimeError("Redis transport requires the `redis` package to be installed")
    return Redis.from_url(settings.NOTIFICATIONS_REDIS_URL)


def get_notification_list_cache_key(user_id: int) -> str:
    return NOTIFICATION_LIST_CACHE_KEY.format(user_id=user_id)


def get_notification_channel(user_id: int) -> str:
    return NOTIFICATION_CHANNEL.format(user_id=user_id)


def load_cached_notification_list(user_id: int) -> list[dict[str, Any]] | None:
    try:
        cached_notifications = cache.get(get_notification_list_cache_key(user_id))
    except Exception:
        logger.warning("notification_cache_read_failed", extra={"user_id": user_id}, exc_info=True)
        return None

    if cached_notifications is None:
        return None

    return list(cached_notifications)


def store_cached_notification_list(user_id: int, notifications: list[dict[str, Any]]) -> None:
    try:
        cache.set(
            get_notification_list_cache_key(user_id),
            notifications,
            timeout=settings.NOTIFICATIONS_CACHE_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.warning("notification_cache_write_failed", extra={"user_id": user_id}, exc_info=True)


def invalidate_cached_notification_list(user_id: int) -> None:
    try:
        cache.delete(get_notification_list_cache_key(user_id))
    except Exception:
        logger.warning("notification_cache_delete_failed", extra={"user_id": user_id}, exc_info=True)


def prepend_cached_notification(user_id: int, notification: dict[str, Any]) -> None:
    cached_notifications = load_cached_notification_list(user_id)
    if cached_notifications is None:
        return

    next_notifications = [notification]
    next_notifications.extend(
        item for item in cached_notifications if item["notifyUserId"] != notification["notifyUserId"]
    )
    store_cached_notification_list(user_id, next_notifications)


def replace_cached_notification(user_id: int, notification: dict[str, Any]) -> None:
    cached_notifications = load_cached_notification_list(user_id)
    if cached_notifications is None:
        return

    next_notifications = []
    replaced = False

    for item in cached_notifications:
        if item["notifyUserId"] == notification["notifyUserId"]:
            next_notifications.append(notification)
            replaced = True
        else:
            next_notifications.append(item)

    if replaced:
        store_cached_notification_list(user_id, next_notifications)


def remove_cached_notification(user_id: int, notify_user_id: int) -> None:
    cached_notifications = load_cached_notification_list(user_id)
    if cached_notifications is None:
        return

    next_notifications = [
        item for item in cached_notifications if item["notifyUserId"] != notify_user_id
    ]
    store_cached_notification_list(user_id, next_notifications)


def publish_notification_created(user_id: int, notification: dict[str, Any]) -> None:
    event = NotificationEvent(
        event="notification.created",
        event_id=int(notification["notifyUserId"]),
        data=notification,
    )

    if use_memory_transport():
        with _memory_lock:
            subscribers = list(_memory_subscribers.get(user_id, []))
        for subscriber in subscribers:
            subscriber.put(event)
        return

    payload = json.dumps(
        {
            "event": event.event,
            "id": event.event_id,
            "data": event.data,
        },
        cls=DjangoJSONEncoder,
    )

    try:
        _get_redis_client().publish(get_notification_channel(user_id), payload)
    except (RedisError, RuntimeError):
        logger.warning("notification_publish_failed", extra={"user_id": user_id}, exc_info=True)


def open_notification_subscription(user_id: int) -> NotificationSubscription:
    if use_memory_transport():
        events: queue.Queue[NotificationEvent] = queue.Queue()
        with _memory_lock:
            _memory_subscribers[user_id].append(events)
        return MemoryNotificationSubscription(user_id=user_id, events=events)

    try:
        pubsub = _get_redis_client().pubsub()
        channel = get_notification_channel(user_id)
        pubsub.subscribe(channel)
    except (RedisError, RuntimeError) as exc:
        logger.error("notification_subscription_failed", extra={"user_id": user_id}, exc_info=True)
        raise RuntimeError("Notification stream transport unavailable") from exc

    return RedisNotificationSubscription(pubsub=pubsub, channel=channel)
