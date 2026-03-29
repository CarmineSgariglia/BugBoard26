from __future__ import annotations

from ...common.realtime import RealtimeEvent, RealtimeEventHub, RealtimeSubscription

type NotificationEvent = RealtimeEvent
type NotificationSubscription = RealtimeSubscription

_notification_event_hub = RealtimeEventHub()


def publish_notification_created(user_id: int, notification: dict[str, object]) -> None:
    _notification_event_hub.publish(
        user_id,
        event="notification.created",
        event_id=int(notification["notifyUserId"]),
        data=notification,
    )


def open_notification_subscription(user_id: int) -> NotificationSubscription:
    return _notification_event_hub.open_subscription(user_id)
