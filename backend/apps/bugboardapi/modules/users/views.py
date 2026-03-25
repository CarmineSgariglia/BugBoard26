"""User management views."""
from __future__ import annotations

from django.contrib.auth.models import User
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view, inline_serializer
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from ...common.parsing import parse_csv_ints_query_param
from ...permissions import require_admin
from ...roles import is_admin_user
from .commands import (
    change_current_user_password,
    filter_users_queryset,
    reset_user_password,
    save_profile_image_for_user,
)
from .policies import ensure_can_edit_user
from .serializers import (
    AdminResetPasswordSerializer,
    ChangePasswordSerializer,
    UserMutationSerializer,
    UserSerializer,
)


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

    def get_queryset(self):
        queryset = super().get_queryset()
        user_ids = parse_csv_ints_query_param(
            raw_value=self.request.query_params.get("userIds"),
            field_name="userIds",
        )
        exclude_user_ids = parse_csv_ints_query_param(
            raw_value=self.request.query_params.get("excludeUserIds"),
            field_name="excludeUserIds",
        )
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

    def create(self, request, *args, **kwargs):
        require_admin(request.user)
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        ensure_can_edit_user(actor=request.user, target_user=user, payload=request.data)
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        ensure_can_edit_user(actor=request.user, target_user=user, payload=request.data)
        return super().update(request, *args, **kwargs)


password_response_serializer = inline_serializer(
    name="UserPasswordUpdateResponse",
    fields={"detail": serializers.CharField()},
)


class CurrentUserPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Users"],
        summary="Change current user password",
        description="Self-service password change for the authenticated user.",
        request=ChangePasswordSerializer,
        responses=password_response_serializer,
    )
    def put(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = change_current_user_password(
            actor=request.user,
            payload=serializer.validated_data,
        )
        return Response(payload)


class UserPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Users"],
        summary="Reset user password",
        description="Admin-only password reset for another user.",
        request=AdminResetPasswordSerializer,
        responses=password_response_serializer,
    )
    def put(self, request, userId):
        require_admin(request.user)
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = reset_user_password(
            actor=request.user,
            target_user_id=userId,
            payload=serializer.validated_data,
        )
        return Response(payload)


class CurrentUserProfileImageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Users"],
        summary="Upload current user profile image",
        request={"multipart/form-data": profile_image_upload_request},
        responses=UserSerializer,
    )
    def put(self, request):
        updated_user = save_profile_image_for_user(request=request, user=request.user)
        return Response(UserSerializer(updated_user, context={"request": request}).data)


class UserProfileImageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Users"],
        summary="Upload profile image for another user",
        description="Admin-only profile image upload for another user.",
        request={"multipart/form-data": profile_image_upload_request},
        responses=UserSerializer,
    )
    def put(self, request, userId):
        require_admin(request.user)
        user = User.objects.filter(pk=userId).first()
        if user is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        updated_user = save_profile_image_for_user(request=request, user=user)
        return Response(UserSerializer(updated_user, context={"request": request}).data)
