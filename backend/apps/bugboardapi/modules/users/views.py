"""User management views."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework import serializers

from ...permissions import check_admin
from ...roles import is_admin_user
from .commands import (
    change_user_password,
    filter_users_queryset,
    parse_csv_ints_query_param,
    save_profile_image_for_user,
)
from .policies import ensure_can_edit_user
from .serializers import (
    AdminResetPasswordSerializer,
    ChangePasswordSerializer,
    UserMutationSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


profile_image_upload_request = inline_serializer(
    name="ProfileImageUploadRequest",
    fields={
        "image": serializers.ImageField(required=False),
        "profile_img": serializers.ImageField(required=False),
    },
)


class UserListPagination(PageNumberPagination):
    page_size = 10
    page_query_param = "page"
    max_page_size = 100


@extend_schema_view(
    list=extend_schema(
        tags=["Users"],
        parameters=[
            OpenApiParameter("page", int, OpenApiParameter.QUERY),
            OpenApiParameter("search", str, OpenApiParameter.QUERY),
            OpenApiParameter("role", str, OpenApiParameter.QUERY),
            OpenApiParameter("status", str, OpenApiParameter.QUERY),
            OpenApiParameter("userIds", str, OpenApiParameter.QUERY),
            OpenApiParameter("excludeUserIds", str, OpenApiParameter.QUERY),
        ],
    ),
    retrieve=extend_schema(tags=["Users"]),
    create=extend_schema(tags=["Users"]),
    partial_update=extend_schema(tags=["Users"]),
    update=extend_schema(tags=["Users"]),
)
class UserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.all().order_by("id")
    lookup_field = "id"
    lookup_url_kwarg = "userId"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = UserListPagination

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return UserMutationSerializer
        return UserSerializer

    def _parse_csv_ints_query_param(self, name: str) -> list[int]:
        return parse_csv_ints_query_param(
            raw_value=self.request.query_params.get(name),
            field_name=name,
        )

    def _validate_user_update_permissions(self, request, user: User) -> None:
        ensure_can_edit_user(actor=request.user, target_user=user, payload=request.data)

    def _profile_image_response(self, *, request, user: User) -> Response:
        updated_user = save_profile_image_for_user(request=request, user=user)
        return Response(self.get_serializer(updated_user).data, status=status.HTTP_200_OK)

    def get_queryset(self):
        queryset = super().get_queryset()
        user_ids = self._parse_csv_ints_query_param("userIds")
        exclude_user_ids = self._parse_csv_ints_query_param("excludeUserIds")
        return filter_users_queryset(
            queryset=queryset,
            actor=self.request.user,
            search_query=self.request.query_params.get("search"),
            role_filter=self.request.query_params.get("role"),
            status_filter=self.request.query_params.get("status"),
            user_ids=user_ids,
            exclude_user_ids=exclude_user_ids,
            is_admin_actor=is_admin_user(self.request.user),
        )

    def perform_create(self, serializer):
        check_admin(self.request.user)
        serializer.save()

    def create(self, request, *args, **kwargs):
        check_admin(request.user)
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        self._validate_user_update_permissions(request, user)
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        self._validate_user_update_permissions(request, user)
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="admin-upload-image")
    @extend_schema(
        tags=["Users"],
        summary="Upload profile image for another user",
        description="Phase 1 accepted multipart endpoint. Admin-only until Phase 2 converges to a resource-oriented path.",
        request={"multipart/form-data": profile_image_upload_request},
        responses=UserSerializer,
    )
    def admin_upload_profile_image(self, request, *args, **kwargs):
        check_admin(request.user)
        user = self.get_object()
        return self._profile_image_response(request=request, user=user)

    @action(detail=False, methods=["post"], url_path="me/upload-profile-image")
    @extend_schema(
        tags=["Users"],
        summary="Upload current user profile image",
        description="Phase 1 accepted multipart endpoint. Canonical path uses kebab-case.",
        request={"multipart/form-data": profile_image_upload_request},
        responses=UserSerializer,
    )
    def upload_profile_image_me(self, request):
        return self._profile_image_response(request=request, user=request.user)

    @action(detail=True, methods=["post"], url_path="change-password")
    @extend_schema(
        tags=["Users"],
        summary="Change own password",
        description="Self-service password change. Requires currentPassword and newPassword.",
        request=ChangePasswordSerializer,
        responses=inline_serializer(
            name="ChangePasswordResponse",
            fields={"detail": serializers.CharField()},
        ),
    )
    def change_password(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = change_user_password(
            actor=request.user,
            target_user_id=self.kwargs.get(self.lookup_url_kwarg),
            payload=serializer.validated_data,
            mode="self-service",
        )
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="admin-reset-password")
    @extend_schema(
        tags=["Users"],
        summary="Admin reset user password",
        description="Admin-only password reset for another user. Accepts only newPassword.",
        request=AdminResetPasswordSerializer,
        responses=inline_serializer(
            name="AdminResetPasswordResponse",
            fields={"detail": serializers.CharField()},
        ),
    )
    def admin_reset_password(self, request, *args, **kwargs):
        check_admin(request.user)
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = change_user_password(
            actor=request.user,
            target_user_id=self.kwargs.get(self.lookup_url_kwarg),
            payload=serializer.validated_data,
            mode="admin-reset",
        )
        return Response(payload)
