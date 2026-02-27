"""Project and membership views."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
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
    parse_int_or_none,
    request_user_ids,
    user_project_ids,
)

logger = logging.getLogger(__name__)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Project.objects.select_related("created_by").all()
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
            user_ids = request_user_ids(self.request.data.get("userIds", []))
            users = User.objects.filter(id__in=user_ids, is_active=True)
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

    def update(self, request, *args, **kwargs):
        check_admin(request.user)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        check_admin(request.user)
        project = self.get_object()
        confirm_name = request.data.get("name")
        if not confirm_name:
            return Response({"detail": "Project name confirmation is required"}, status=status.HTTP_400_BAD_REQUEST)
        if confirm_name != project.name:
            return Response({"detail": "Project name confirmation mismatch"}, status=status.HTTP_400_BAD_REQUEST)

        recipient_users = list(User.objects.filter(project_memberships__project=project).distinct())
        if recipient_users:
            notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=recipient_users, project=project)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, projectId=None):
        project = self.get_object()
        ensure_project_access(request.user, project)

        if request.method == "GET":
            memberships = ProjectMembership.objects.filter(project=project).select_related("user")
            return Response(ProjectMembershipSerializer(memberships, many=True).data)

        # POST — add member
        check_admin(request.user)
        user_id = parse_int_or_none(request.data.get("userId"))
        if not user_id:
            raise ValidationError({"userId": "This field is required"})
        role = request.data.get("role", ProjectMembership.Role.DEVELOPER)
        if role not in dict(ProjectMembership.Role.choices):
            raise ValidationError({"role": "Invalid role"})
        user = User.objects.filter(id=user_id, is_active=True).first()
        if not user:
            raise ValidationError({"userId": "Active user not found"})
        membership, created = ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": role},
        )
        if not created:
            membership.role = role
            membership.save(update_fields=["role"])
        notify_users(notify_type=NotifyType.PROJECT_ADDED, users=[membership.user], project=project)
        return Response(ProjectMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"members/(?P<userId>[^/.]+)")
    def remove_member(self, request, projectId=None, userId=None):
        check_admin(request.user)
        project = self.get_object()
        ensure_project_access(request.user, project)
        membership = ProjectMembership.objects.filter(project=project, user_id=userId).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if membership.user_id == project.created_by_id:
            return Response({"detail": "Project creator cannot be removed from membership"}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == ProjectMembership.Role.ADMIN:
            admin_count = ProjectMembership.objects.filter(project=project, role=ProjectMembership.Role.ADMIN).count()
            if admin_count <= 1:
                return Response({"detail": "Cannot remove the last project admin"}, status=status.HTTP_400_BAD_REQUEST)
        user = membership.user
        membership.delete()
        notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=[user], project=project)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
