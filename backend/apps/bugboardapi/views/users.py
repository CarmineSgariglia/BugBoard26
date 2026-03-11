"""User management views."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..passwords import ensure_valid_password
from ..roles import ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME
from ..permissions import check_admin, is_admin
from ..serializers import ChangePasswordSerializer, UserSerializer
from ..services import save_profile_image_for_user

logger = logging.getLogger(__name__)


class UserListPagination(PageNumberPagination):
    page_size = 10
    page_query_param = "page"
    max_page_size = 100


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

    def _validate_user_update_permissions(self, request, user: User) -> None:
        if request.user != user and not is_admin(request.user):
            raise PermissionDenied("Cannot edit other users")
        if is_admin(request.user) and request.user == user and any(
            field in request.data for field in {"active", "group", "isAdmin"}
        ):
            raise PermissionDenied("You cannot change your own active status or role")
        if not is_admin(request.user):
            forbidden_fields = {"isAdmin", "group", "active"}
            if any(field in request.data for field in forbidden_fields):
                raise PermissionDenied("You cannot modify admin or active flags")

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_admin(self.request.user):
            queryset = queryset.filter(id=self.request.user.id)
        search_query = self.request.query_params.get("search")
        role_filter = self.request.query_params.get("role")
        status_filter = self.request.query_params.get("status")
        
        user_ids = self.request.query_params.get("userIds")
        if user_ids:
            ids = [int(i.strip()) for i in user_ids.split(",") if i.strip()]
            if ids:
                queryset = queryset.filter(id__in=ids)
                
        exclude_user_ids = self.request.query_params.get("excludeUserIds")
        if exclude_user_ids:
            ids = [int(i.strip()) for i in exclude_user_ids.split(",") if i.strip()]
            if ids:
                queryset = queryset.exclude(id__in=ids)

        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query)
                | Q(email__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
            )

        if role_filter == "Admin":
            queryset = queryset.filter(groups__name=ADMIN_GROUP_NAME)
        elif role_filter in {"User", "Developer"}:
            queryset = queryset.filter(groups__name=DEVELOPER_GROUP_NAME)

        if status_filter == "Active":
            queryset = queryset.filter(is_active=True)
        elif status_filter == "Inactive":
            queryset = queryset.filter(is_active=False)

        return queryset.distinct()

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

    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, userId=None):
        check_admin(request.user)
        user = self.get_object()
        active = request.data.get("active", None)
        if not isinstance(active, bool):
            raise ValidationError({"active": "Boolean value is required"})
        if request.user == user:
            raise PermissionDenied("You cannot deactivate your own account")

        user.is_active = active
        user.save(update_fields=["is_active"])
        refreshed_user = User.objects.get(id=user.id)
        return Response(UserSerializer(refreshed_user, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="admin-upload-image")
    def admin_upload_profile_image(self, request, userId=None):
        check_admin(request.user)
        user = self.get_object()
        payload = save_profile_image_for_user(request=request, user=user)
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="me/upload_profile_image")
    def upload_profile_image_me(self, request):
        payload = save_profile_image_for_user(request=request, user=request.user)
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="me/upload-profile-image")
    def upload_profile_image_me_kebab(self, request):
        payload = save_profile_image_for_user(request=request, user=request.user)
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="change-password")
    def change_password(self, request, userId=None):
        target_user_id = self.kwargs.get(self.lookup_url_kwarg)
        user = User.objects.filter(id=target_user_id).first()
        if user is None:
            raise NotFound("User not found")

        is_admin_reset = is_admin(request.user) and request.user != user
        if request.user != user and not is_admin(request.user):
            raise PermissionDenied("Cannot change password for other users")

        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        current_password = serializer.validated_data.get("currentPassword", "")
        new_password = serializer.validated_data["newPassword"]

        if is_admin_reset:
            if user.check_password(new_password):
                raise ValidationError({"newPassword": "New password must be different from current password"})
        else:
            if not current_password:
                raise ValidationError({"currentPassword": "Current password is required"})
            if not user.check_password(current_password):
                raise ValidationError({"currentPassword": "Current password is incorrect"})

        if user.check_password(new_password):
            raise ValidationError({"newPassword": "New password must be different from current password"})

        ensure_valid_password(new_password, user=user, field_name="newPassword")

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated"})

    @action(detail=True, methods=["post"], url_path="admin-reset-password")
    def admin_reset_password(self, request, userId=None):
        check_admin(request.user)
        return self.change_password(request, userId=userId)
