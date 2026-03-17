"""Project and membership views."""
from __future__ import annotations

import logging

from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from ...permissions import check_admin, ensure_project_access, is_admin, user_project_ids
from ..issues.commands import create_issue_for_project
from ..issues.serializers import IssueSerializer
from .commands import (
    build_project_members_payload,
    create_project_with_team,
    delete_project_and_notify,
    list_project_issues_payload,
    update_project_with_team,
)
from .models import Project
from .serializers import ProjectSerializer

logger = logging.getLogger(__name__)


class ProjectViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Project.objects.select_related("created_by", "created_by__profile").all()
    lookup_field = "project_id"
    lookup_url_kwarg = "projectId"

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_admin(self.request.user):
            queryset = queryset.filter(project_id__in=user_project_ids(self.request.user))
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(name__icontains=q)
        return queryset

    def perform_create(self, serializer):
        check_admin(self.request.user)
        raw_user_ids = self.request.data.get("userIds", self.request.data.get("team", []))
        create_project_with_team(serializer=serializer, owner=self.request.user, raw_user_ids=raw_user_ids)

    def update(self, request, *args, **kwargs):
        check_admin(request.user)
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        payload = request.data.copy()
        has_team_payload = "team" in payload or "userIds" in payload
        raw_user_ids = payload.get("userIds", payload.get("team", []))
        payload.pop("team", None)
        payload.pop("userIds", None)

        serializer = self.get_serializer(instance, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)

        update_project_with_team(
            serializer=serializer,
            project=instance,
            raw_user_ids=raw_user_ids,
            has_team_payload=has_team_payload,
        )

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        check_admin(request.user)
        project = self.get_object()
        delete_project_and_notify(project=project)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, projectId=None):
        project = self.get_object()
        ensure_project_access(request.user, project)
        include_admins = str(request.query_params.get("includeAdmins", "")).lower() in {"1", "true", "yes"}
        return Response(build_project_members_payload(project=project, include_admins=include_admins))


class ProjectIssueListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, projectId):
        project = Project.objects.filter(project_id=projectId).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        return Response(list_project_issues_payload(project=project, request=request))

    def post(self, request, projectId):
        project = Project.objects.filter(project_id=projectId).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        issue = create_issue_for_project(request=request, project=project)
        return Response(IssueSerializer(issue).data, status=status.HTTP_201_CREATED)
