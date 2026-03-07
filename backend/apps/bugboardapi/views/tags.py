"""Tag and metadata enum views."""
from __future__ import annotations

import logging

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes as perm_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Issue, IssueEvent, NotifyType, Tag
from ..permissions import is_admin
from ..serializers import TagSerializer

logger = logging.getLogger(__name__)


@api_view(["GET"])
@perm_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


class TagViewSet(viewsets.ModelViewSet):
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


class MetaEnumsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, _request):
        return Response(
            {
                "issueType": [value for value, _ in Issue._meta.get_field("issue_type").choices],
                "issueStatus": [value for value, _ in Issue._meta.get_field("status").choices],
                "priority": [value for value, _ in Issue._meta.get_field("priority").choices],
                "eventType": [value for value, _ in IssueEvent._meta.get_field("event_type").choices],
                "notifyType": [value for value, _ in NotifyType.choices],
            }
        )
