"""Notification views."""
from __future__ import annotations

import logging

from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ...common.sse import (
    ServerSentEventsRenderer,
    build_sse_response,
    parse_last_event_id,
    stream_sse_events,
)
from .models import NotifyUser
from .realtime import open_notification_subscription
from .services import notification_service
from .serializers import NotifyUserSerializer
from .serializers import NotificationPatchSerializer, NotificationsPageSerializer

logger = logging.getLogger(__name__)

DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20
MAX_NOTIFICATIONS_PAGE_SIZE = 50


@extend_schema_view(
    list=extend_schema(
        tags=["Notifications"],
        description="Cursor-based notification feed for the authenticated user.",
        parameters=[
            OpenApiParameter("limit", int, OpenApiParameter.QUERY),
            OpenApiParameter("before", int, OpenApiParameter.QUERY),
        ],
        responses=NotificationsPageSerializer,
    ),
    partial_update=extend_schema(
        tags=["Notifications"],
        summary="Update notification state",
        request=NotificationPatchSerializer,
        responses=NotifyUserSerializer,
    ),
    destroy=extend_schema(tags=["Notifications"], responses={204: OpenApiResponse(description="Notification deleted")}),
    stream=extend_schema(
        tags=["Notifications"],
        summary="Stream notifications",
        description="Server-Sent Events stream for the authenticated user.",
        responses={(200, "text/event-stream"): OpenApiTypes.STR},
    ),
)
class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotifyUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = NotifyUser.objects.select_related("notification", "notification__issue", "notification__project")
    lookup_field = "notify_user_id"
    lookup_url_kwarg = "notificationId"

    def get_renderers(self):
        if getattr(self, "action", None) == "stream":
            return [ServerSentEventsRenderer()]
        return super().get_renderers()

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

    def list(self, request, *args, **kwargs):
        limit = self._parse_positive_int(
            request.query_params.get("limit"),
            field_name="limit",
            default=DEFAULT_NOTIFICATIONS_PAGE_SIZE,
        )
        assert limit is not None
        limit = min(limit, MAX_NOTIFICATIONS_PAGE_SIZE)
        before = self._parse_positive_int(request.query_params.get("before"), field_name="before")

        return Response(
            notification_service.list_page(
                user=request.user,
                limit=limit,
                before=before,
            )
        )

    def partial_update(self, request, *args, **kwargs):
        serializer = NotificationPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notify_user = self.get_object()
        notify_user = notification_service.mark_as_read(notify_user=notify_user)
        return Response(NotifyUserSerializer(notify_user).data)

    def destroy(self, request, *args, **kwargs):
        notify_user = self.get_object()
        notification_service.delete_for_user(notify_user=notify_user)
        return Response(status=status.HTTP_204_NO_CONTENT)

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

        last_seen_id = parse_last_event_id(request)
        heartbeat_interval = max(float(getattr(settings, "NOTIFICATIONS_STREAM_HEARTBEAT_SECONDS", 20.0)), 1.0)
        catchup_notifications = notification_service.load_catchup_notifications(
            user_id=request.user.id,
            last_seen_id=last_seen_id,
        )

        return build_sse_response(
            stream_sse_events(
                catchup_items=catchup_notifications,
                serialize_catchup_item=notification_service.serialize_stream_item,
                subscription=subscription,
                last_seen_id=last_seen_id,
                heartbeat_interval=heartbeat_interval,
                on_disconnect=lambda: logger.debug(
                    "notification_stream_client_disconnected",
                    extra={"user_id": request.user.id},
                ),
            )
        )
