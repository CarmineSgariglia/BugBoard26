"""Project and membership views."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    EventType,
    Issue,
    IssueEvent,
    NotifyType,
    Project,
    ProjectMembership,
    Tag,
)
from ..permissions import is_admin
from ..serializers import IssueSerializer, ProjectMembershipSerializer, ProjectSerializer
from ..services import notify_users
from .helpers import (
    apply_issue_filters,
    check_admin,
    create_issue_for_project,
    ensure_project_access,
    request_user_ids,
    user_project_ids,
)

logger = logging.getLogger(__name__)


class ProjectViewSet(viewsets.ModelViewSet):
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
            ProjectMembership.objects.get_or_create(
                project=project,
                user=self.request.user,
                defaults={"role": ProjectMembership.Role.ADMIN},
            )
            raw_user_ids = self.request.data.get("userIds", self.request.data.get("team", []))
            user_ids = request_user_ids(raw_user_ids)
            users = User.objects.filter(id__in=user_ids, is_active=True).exclude(id=self.request.user.id)
            members = []
            for user in users:
                member, _ = ProjectMembership.objects.get_or_create(
                    project=project,
                    user=user,
                    defaults={"role": ProjectMembership.Role.DEVELOPER},
                )
                members.append(member.user)
            if members:
                notify_users(notify_type=NotifyType.PROJECT_ADDED, users=members, project=project)

    def _sync_team_members(self, *, project: Project, raw_user_ids):
        user_ids = request_user_ids(raw_user_ids)
        target_users = list(
            User.objects.filter(id__in=user_ids, is_active=True).exclude(id=project.created_by_id)
        )
        target_user_ids = {user.id for user in target_users}

        developer_memberships = ProjectMembership.objects.filter(
            project=project,
            role=ProjectMembership.Role.DEVELOPER,
        ).select_related("user")
        current_developer_ids = {membership.user_id for membership in developer_memberships}

        to_add_ids = target_user_ids - current_developer_ids
        to_remove_ids = current_developer_ids - target_user_ids

        added_users = [user for user in target_users if user.id in to_add_ids]
        for user in added_users:
            ProjectMembership.objects.get_or_create(
                project=project,
                user=user,
                defaults={"role": ProjectMembership.Role.DEVELOPER},
            )

        removed_memberships = list(developer_memberships.filter(user_id__in=to_remove_ids))
        removed_users = [membership.user for membership in removed_memberships]
        if to_remove_ids:
            developer_memberships.filter(user_id__in=to_remove_ids).delete()

        if added_users:
            notify_users(notify_type=NotifyType.PROJECT_ADDED, users=added_users, project=project)
        if removed_users:
            notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=removed_users, project=project)

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
                self._sync_team_members(project=instance, raw_user_ids=raw_user_ids)

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        check_admin(request.user)
        project = self.get_object()

        recipient_users = list(User.objects.filter(project_memberships__project=project).distinct())
        if recipient_users:
            notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=recipient_users, project=project)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, projectId=None):
        project = self.get_object()
        ensure_project_access(request.user, project)

        memberships = ProjectMembership.objects.filter(project=project).select_related("user")
        return Response(ProjectMembershipSerializer(memberships, many=True).data)


class ProjectIssueListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, projectId):
        project = Project.objects.filter(project_id=projectId).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        queryset = Issue.objects.filter(project=project).select_related("project", "reporter").prefetch_related("assignees", "tags")
        queryset = apply_issue_filters(queryset, request)
        return Response(IssueSerializer(queryset, many=True).data)

    def post(self, request, projectId):
        project = Project.objects.filter(project_id=projectId).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        issue = create_issue_for_project(request=request, project=project)
        return Response(IssueSerializer(issue).data, status=status.HTTP_201_CREATED)
