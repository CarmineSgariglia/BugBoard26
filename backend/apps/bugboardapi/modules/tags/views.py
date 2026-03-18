"""Tag views."""
from __future__ import annotations

import logging

from rest_framework import mixins, permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from ...permissions import is_admin
from .models import Tag
from .serializers import TagSerializer

logger = logging.getLogger(__name__)


class TagViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Tag.objects.all()
    lookup_field = "tag_id"
    lookup_url_kwarg = "tagId"

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only admins can create tags")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        if not is_admin(request.user):
            raise PermissionDenied("Only admins can delete tags")
        return super().destroy(request, *args, **kwargs)
