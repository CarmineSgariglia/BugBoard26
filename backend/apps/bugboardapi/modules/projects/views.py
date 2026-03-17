"""Project and membership views."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from ...permissions import check_admin, ensure_project_access, is_admin, user_project_ids
from ...roles import is_admin_user
from ..issues.models import Issue
from ..issues.serializers import IssueSerializer
from ..issues.services import apply_issue_filters, create_issue_for_project
from ..notifications.models import NotifyType
from ..notifications.services import notify_users
from .models import Project, ProjectMembership
from .serializers import ProjectMembershipSerializer, ProjectSerializer
from .services import create_project_memberships, sync_project_team_members

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
        with transaction.atomic():
            project = serializer.save(created_by=self.request.user)
            raw_user_ids = self.request.data.get("userIds", self.request.data.get("team", []))
            create_project_memberships(project=project, owner=self.request.user, raw_user_ids=raw_user_ids)

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

        with transaction.atomic():
            self.perform_update(serializer)
            if has_team_payload:
                sync_project_team_members(
                    project=instance,
                    raw_user_ids=raw_user_ids,
                    actor=request.user,
                )

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        check_admin(request.user)
        project = self.get_object()

        recipient_users = list(User.objects.filter(project_memberships__project=project).distinct())
        if recipient_users:
            notify_users(
                notify_type=NotifyType.PROJECT_REMOVED,
                users=recipient_users,
                actor=request.user,
                project=project,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, projectId=None):
        project = self.get_object()
        ensure_project_access(request.user, project)

        memberships = ProjectMembership.objects.filter(project=project).select_related("user")
        include_admins = str(request.query_params.get("includeAdmins", "")).lower() in {"1", "true", "yes"}
        if not include_admins:
            memberships = [membership for membership in memberships if not is_admin_user(membership.user)]
        return Response(ProjectMembershipSerializer(memberships, many=True).data)


class ProjectIssueListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, projectId):
        project = Project.objects.filter(project_id=projectId).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        queryset = Issue.objects.filter(project=project).select_related("project", "reporter", "reporter__profile").prefetch_related("assignees", "tags")
        queryset = apply_issue_filters(queryset, request)
        return Response(IssueSerializer(queryset, many=True).data)

    def post(self, request, projectId):
        project = Project.objects.filter(project_id=projectId).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        issue = create_issue_for_project(request=request, project=project)
        return Response(IssueSerializer(issue).data, status=status.HTTP_201_CREATED)
