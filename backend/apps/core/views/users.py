"""User management views."""
from __future__ import annotations

import logging
import uuid

from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..models import UserProfile
from ..permissions import is_admin
from ..serializers import ChangePasswordSerializer, UserSerializer
from .helpers import check_admin

logger = logging.getLogger(__name__)


class UserListPagination(PageNumberPagination):
    page_size = 10
    page_query_param = "page"
    max_page_size = 100


class UserViewSet(viewsets.ModelViewSet):
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
        if not is_admin(request.user):
            forbidden_fields = {"isAdmin", "active"}
            if any(field in request.data for field in forbidden_fields):
                raise PermissionDenied("You cannot modify admin or active flags")

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_admin(self.request.user):
            queryset = queryset.filter(id=self.request.user.id)
        search_query = self.request.query_params.get("search")
        role_filter = self.request.query_params.get("role")
        status_filter = self.request.query_params.get("status")

        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query)
                | Q(email__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
            )

        if role_filter == "Admin":
            queryset = queryset.filter(profile__is_admin=True)
        elif role_filter == "User":
            queryset = queryset.filter(profile__is_admin=False)

        if status_filter == "Active":
            queryset = queryset.filter(is_active=True)
        elif status_filter == "Inactive":
            queryset = queryset.filter(is_active=False)

        return queryset

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

    def destroy(self, request, *args, **kwargs):
        raise PermissionDenied("User deletion is disabled. Use /disable/ endpoint.")

    @action(detail=True, methods=["post"], url_path="disable")
    def disable(self, request, userId=None):
        check_admin(request.user)
        user = self.get_object()
        username = request.data.get("username", "")
        if username != user.username:
            return Response({"detail": "Username confirmation mismatch"}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = False
        user.save(update_fields=["is_active"])
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.active = False
        profile.save(update_fields=["active"])
        return Response({"detail": "User disabled"})

    def _save_profile_image_for_user(self, *, request, user: User):
        if request.user != user and not is_admin(request.user):
            raise PermissionDenied("Cannot edit other users")

        image = request.FILES.get("image") or request.FILES.get("profile_img")
        if image is None:
            raise ValidationError({"image": "Image file is required"})
        if image.size > 2 * 1024 * 1024:
            raise ValidationError({"image": "Max image size is 2MB"})

        content_type = (getattr(image, "content_type", "") or "").lower()
        allowed_types = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        if content_type not in allowed_types:
            raise ValidationError({"image": "Allowed formats: JPEG, PNG, WEBP"})

        extension = allowed_types[content_type]
        upload_path = f"profile-images/{user.id}/{uuid.uuid4().hex}.{extension}"
        saved_path = default_storage.save(upload_path, image)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        old_path = profile.profile_img
        profile.profile_img = saved_path
        profile.save(update_fields=["profile_img"])

        if old_path and old_path != saved_path and old_path.startswith("profile-images/"):
            try:
                default_storage.delete(old_path)
            except Exception:
                logger.warning("Failed to delete old profile image: %s", old_path)

        refreshed_user = User.objects.get(id=user.id)
        return UserSerializer(refreshed_user, context={"request": request}).data

    @action(detail=True, methods=["post"], url_path="profile-image")
    def upload_profile_image(self, request, userId=None):
        user = self.get_object()
        payload = self._save_profile_image_for_user(request=request, user=user)
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="admin-upload-image")
    def admin_upload_profile_image(self, request, userId=None):
        check_admin(request.user)
        return self.upload_profile_image(request, userId=userId)

    @action(detail=False, methods=["post"], url_path="me/upload_profile_image")
    def upload_profile_image_me(self, request):
        payload = self._save_profile_image_for_user(request=request, user=request.user)
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

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated"})

    @action(detail=True, methods=["post"], url_path="admin-reset-password")
    def admin_reset_password(self, request, userId=None):
        check_admin(request.user)
        return self.change_password(request, userId=userId)
