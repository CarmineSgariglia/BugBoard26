"""Notification views."""
from __future__ import annotations

import logging

from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import NotifyUser
from ..serializers import NotifyUserSerializer

logger = logging.getLogger(__name__)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotifyUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = NotifyUser.objects.select_related("notification", "notification__issue", "notification__project")
    lookup_field = "notify_user_id"
    lookup_url_kwarg = "notificationId"

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, notificationId=None):
        notify_user = self.get_object()
        notify_user.is_read = True
        notify_user.read_at = timezone.now()
        notify_user.save(update_fields=["is_read", "read_at"])
        return Response(NotifyUserSerializer(notify_user).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = NotifyUser.objects.filter(user=request.user, is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"updated": updated})
