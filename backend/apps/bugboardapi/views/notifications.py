"""Notification views."""
from __future__ import annotations

import json
import logging

from django.conf import settings
from django.db import transaction
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response

from ..models import Notification, NotifyUser
from ..serializers import NotifyUserSerializer
from ..services.notification_realtime import (
    invalidate_cached_notification_list,
    open_notification_subscription,
    remove_cached_notification,
    replace_cached_notification,
)

logger = logging.getLogger(__name__)

DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20
MAX_NOTIFICATIONS_PAGE_SIZE = 50


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


def _format_sse_event(*, event: str, data: object | None = None, event_id: int | None = None) -> str:
    lines: list[str] = [f"event: {event}"]
    if event_id is not None:
        lines.append(f"id: {event_id}")
    if data is not None:
        payload = data if isinstance(data, str) else json.dumps(data)
        for line in payload.splitlines() or [""]:
            lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotifyUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = NotifyUser.objects.select_related("notification", "notification__issue", "notification__project")
    lookup_field = "notify_user_id"
    lookup_url_kwarg = "notificationId"

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user).order_by("-notify_user_id")

    def _parse_positive_int(self, raw_value: str | None, *, field_name: str, default: int | None = None) -> int | None:
        if raw_value in (None, ""):
            return default

        try:
            value = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValidationError({field_name: "Must be a positive integer."}) from exc

        if value <= 0:
            raise ValidationError({field_name: "Must be a positive integer."})

        return value

    def _load_notifications_from_db(self, *, limit: int, before: int | None = None) -> list[NotifyUser]:
        queryset = self.get_queryset()
        if before is not None:
            queryset = queryset.filter(notify_user_id__lt=before)
        return list(queryset[: limit + 1])

    def _serialize_notifications_page(self, notifications: list[NotifyUser], *, limit: int) -> dict[str, object]:
        page_items = notifications[:limit]
        has_more = len(notifications) > limit
        next_cursor = page_items[-1].notify_user_id if has_more and page_items else None
        has_unread = NotifyUser.objects.filter(user=self.request.user, is_read=False).exists()

        return {
            "results": NotifyUserSerializer(page_items, many=True).data,
            "nextCursor": next_cursor if has_more else None,
            "hasMore": has_more,
            "hasUnread": has_unread,
        }

    def list(self, request, *args, **kwargs):
        limit = self._parse_positive_int(
            request.query_params.get("limit"),
            field_name="limit",
            default=DEFAULT_NOTIFICATIONS_PAGE_SIZE,
        )
        assert limit is not None
        limit = min(limit, MAX_NOTIFICATIONS_PAGE_SIZE)
        before = self._parse_positive_int(request.query_params.get("before"), field_name="before")

        notifications = self._load_notifications_from_db(limit=limit, before=before)
        return Response(self._serialize_notifications_page(notifications, limit=limit))

    def _mark_as_read(self, notify_user: NotifyUser) -> NotifyUser:
        if notify_user.is_read:
            return notify_user
        notify_user.is_read = True
        notify_user.read_at = timezone.now()
        notify_user.save(update_fields=["is_read", "read_at"])
        return notify_user

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, notificationId=None):
        notify_user = self.get_object()
        notify_user = self._mark_as_read(notify_user)
        payload = NotifyUserSerializer(notify_user).data
        replace_cached_notification(request.user.id, payload)
        return Response(payload)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = NotifyUser.objects.filter(user=request.user, is_read=False).update(is_read=True, read_at=timezone.now())
        invalidate_cached_notification_list(request.user.id)
        return Response({"updated": updated})

    def destroy(self, request, *args, **kwargs):
        notify_user = self.get_object()
        notification_id = notify_user.notification_id
        notify_user_id = notify_user.notify_user_id

        with transaction.atomic():
            notify_user.delete()
            if not NotifyUser.objects.filter(notification_id=notification_id).exists():
                Notification.objects.filter(notification_id=notification_id).delete()

        remove_cached_notification(request.user.id, notify_user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _parse_last_event_id(self, request) -> int:
        raw_last_event_id = request.headers.get("Last-Event-ID", "").strip()
        if not raw_last_event_id:
            return 0
        try:
            return max(int(raw_last_event_id), 0)
        except ValueError:
            return 0

    def _load_catchup_notifications(self, *, user_id: int, last_seen_id: int) -> list[NotifyUser]:
        return list(
            NotifyUser.objects.select_related(
                "notification",
                "notification__issue",
                "notification__project",
            )
            .filter(user_id=user_id, notify_user_id__gt=last_seen_id)
            .order_by("notify_user_id")
        )

    def _stream_notifications(self, request, *, last_seen_id: int, subscription):
        heartbeat_interval = max(float(getattr(settings, "NOTIFICATIONS_STREAM_HEARTBEAT_SECONDS", 20.0)), 1.0)
        current_last_seen = last_seen_id

        try:
            catchup_notifications = self._load_catchup_notifications(
                user_id=request.user.id,
                last_seen_id=current_last_seen,
            )
            for notify_user in catchup_notifications:
                current_last_seen = notify_user.notify_user_id
                payload = NotifyUserSerializer(notify_user).data
                yield _format_sse_event(
                    event="notification.created",
                    data=payload,
                    event_id=current_last_seen,
                )

            while True:
                notification_event = subscription.get_message(timeout=heartbeat_interval)
                if notification_event is None:
                    yield _format_sse_event(event="ping", data={})
                    continue

                if notification_event.event_id <= current_last_seen:
                    continue

                current_last_seen = notification_event.event_id
                yield _format_sse_event(
                    event=notification_event.event,
                    data=notification_event.data,
                    event_id=notification_event.event_id,
                )
        except GeneratorExit:
            logger.debug("notification_stream_client_disconnected", extra={"user_id": request.user.id})
        finally:
            subscription.close()

    @action(
        detail=False,
        methods=["get"],
        url_path="stream",
        renderer_classes=[ServerSentEventsRenderer],
    )
    def stream(self, request):
        try:
            subscription = open_notification_subscription(request.user.id)
        except RuntimeError:
            return Response(
                {"detail": "Notification stream unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        response = StreamingHttpResponse(
            self._stream_notifications(
                request,
                last_seen_id=self._parse_last_event_id(request),
                subscription=subscription,
            ),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
