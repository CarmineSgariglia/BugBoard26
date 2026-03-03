"""Notification views."""
from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Notification, NotifyUser
from ..serializers import NotifyUserSerializer

logger = logging.getLogger(__name__)


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
        return super().get_queryset().filter(user=self.request.user)

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
        return Response(NotifyUserSerializer(notify_user).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = NotifyUser.objects.filter(user=request.user, is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"updated": updated})

    def destroy(self, request, *args, **kwargs):
        notify_user = self.get_object()
        notification_id = notify_user.notification_id

        with transaction.atomic():
            notify_user.delete()
            if not NotifyUser.objects.filter(notification_id=notification_id).exists():
                Notification.objects.filter(notification_id=notification_id).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
