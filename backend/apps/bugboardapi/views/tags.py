"""Tag views."""
from __future__ import annotations

import logging

from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..models import Tag
from ..permissions import is_admin
from ..serializers import TagSerializer

logger = logging.getLogger(__name__)


@api_view(["GET"])
@perm_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


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
