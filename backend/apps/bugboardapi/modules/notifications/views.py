"""Notification views."""
from __future__ import annotations

import logging

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ...common.sse import ServerSentEventsRenderer, format_sse_event
from .models import NotifyUser
from .realtime import open_notification_subscription
from .services import (
    delete_notification_for_user,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)
from .serializers import NotifyUserSerializer

logger = logging.getLogger(__name__)

DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20
MAX_NOTIFICATIONS_PAGE_SIZE = 50


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

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, notificationId=None):
        notify_user = self.get_object()
        notify_user = mark_notification_as_read(notify_user=notify_user)
        return Response(NotifyUserSerializer(notify_user).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = mark_all_notifications_as_read(user=request.user)
        return Response({"updated": updated})

    def destroy(self, request, *args, **kwargs):
        notify_user = self.get_object()
        delete_notification_for_user(notify_user=notify_user)
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
                yield format_sse_event(
                    event="notification.created",
                    data=payload,
                    event_id=current_last_seen,
                )

            while True:
                notification_event = subscription.get_message(timeout=heartbeat_interval)
                if notification_event is None:
                    yield format_sse_event(event="ping", data={})
                    continue

                if notification_event.event_id <= current_last_seen:
                    continue

                current_last_seen = notification_event.event_id
                yield format_sse_event(
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
