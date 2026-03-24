"""Project and membership views."""
from __future__ import annotations

import logging

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers

from ...permissions import filter_by_project_access, require_admin, require_project_access
from .membership import (
    is_admin_project_subscribed,
    subscribe_admin_to_project,
    unsubscribe_admin_from_project,
)
from .commands import (
    create_project_with_team,
    delete_project_and_notify,
    update_project_with_team,
)
from .models import Project
from .queries import list_project_memberships
from .serializers import ProjectMembershipSerializer, ProjectSerializer

logger = logging.getLogger(__name__)


subscription_state_serializer = inline_serializer(
    name="ProjectSubscriptionState",
    fields={"subscribed": serializers.BooleanField()},
)


def _extract_team_payload(data):
    payload = data.copy()
    has_team_payload = "team" in payload or "userIds" in payload
    raw_user_ids = payload.get("userIds", payload.get("team", []))
    payload.pop("team", None)
    payload.pop("userIds", None)
    return payload, raw_user_ids, has_team_payload


@extend_schema_view(
    list=extend_schema(
        tags=["Projects"],
        parameters=[OpenApiParameter("q", str, OpenApiParameter.QUERY)],
    ),
    retrieve=extend_schema(tags=["Projects"]),
    create=extend_schema(tags=["Projects"]),
    partial_update=extend_schema(tags=["Projects"]),
    update=extend_schema(tags=["Projects"]),
    destroy=extend_schema(tags=["Projects"], responses={204: OpenApiResponse(description="Project deleted")}),
)
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
        queryset = filter_by_project_access(queryset=queryset, user=self.request.user)
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(name__icontains=q)
        return queryset

    def perform_create(self, serializer):
        require_admin(self.request.user)
        raw_user_ids = self.request.data.get("userIds", self.request.data.get("team", []))
        create_project_with_team(serializer=serializer, creator=self.request.user, raw_user_ids=raw_user_ids)

    def update(self, request, *args, **kwargs):
        require_admin(request.user)
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        payload, raw_user_ids, has_team_payload = _extract_team_payload(request.data)

        serializer = self.get_serializer(instance, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)

        update_project_with_team(
            serializer=serializer,
            project=instance,
            raw_user_ids=raw_user_ids,
            has_team_payload=has_team_payload,
            actor=request.user,
        )

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        require_admin(request.user)
        project = self.get_object()
        delete_project_and_notify(project=project)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="members")
    @extend_schema(
        tags=["Projects"],
        parameters=[OpenApiParameter("includeAdmins", bool, OpenApiParameter.QUERY)],
        responses=ProjectMembershipSerializer(many=True),
    )
    def members(self, request, *args, **kwargs):
        project = self.get_object()
        require_project_access(request.user, project)
        include_admins = str(request.query_params.get("includeAdmins", "")).lower() in {"1", "true", "yes"}
        memberships = list_project_memberships(project=project, include_admins=include_admins)
        return Response(ProjectMembershipSerializer(memberships, many=True).data)

    @action(detail=True, methods=["get", "put", "delete"], url_path="subscriptions/me")
    @extend_schema(
        tags=["Projects"],
        summary="Project subscription",
        description="Admin subscription state for the authenticated user on the project.",
        request=None,
        responses={
            200: subscription_state_serializer,
            204: OpenApiResponse(description="Subscription updated"),
        },
    )
    def subscription(self, request, *args, **kwargs):
        require_admin(request.user)
        project = self.get_object()

        if request.method == "GET":
            return Response({
                "subscribed": is_admin_project_subscribed(project=project, user=request.user),
            })

        if request.method == "PUT":
            subscribe_admin_to_project(project=project, user=request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)

        unsubscribe_admin_from_project(project=project, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
