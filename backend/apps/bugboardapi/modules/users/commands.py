import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db.models import Q, QuerySet
from rest_framework.exceptions import NotFound, ValidationError

from ...roles import ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME
from ...security.passwords import ensure_valid_password
from ...security.uploads import store_upload, validate_profile_image
from .policies import (
    ensure_can_upload_profile_image,
    validate_password_change_request,
    validate_status_change_request,
)
from .models import UserProfileImage
from .serializers import UserSerializer

logger = logging.getLogger(__name__)


def parse_csv_ints_query_param(*, raw_value: str | None, field_name: str) -> list[int]:
    normalized = (raw_value or "").strip()
    if not normalized:
        return []
    values = [value.strip() for value in normalized.split(",") if value.strip()]
    try:
        return [int(value) for value in values]
    except ValueError as exc:
        raise ValidationError({field_name: "All values must be valid integers"}) from exc


def filter_users_queryset(
    *,
    queryset: QuerySet,
    actor: User,
    search_query: str | None,
    role_filter: str | None,
    status_filter: str | None,
    user_ids: list[int],
    exclude_user_ids: list[int],
    is_admin_actor: bool,
):
    if not is_admin_actor:
        queryset = queryset.filter(id=actor.id)

    if user_ids:
        queryset = queryset.filter(id__in=user_ids)

    if exclude_user_ids:
        queryset = queryset.exclude(id__in=exclude_user_ids)

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


def set_user_status(*, actor: User, target_user: User, active, request):
    validate_status_change_request(actor=actor, target_user=target_user, active=active)
    target_user.is_active = active
    target_user.save(update_fields=["is_active"])
    refreshed_user = User.objects.get(id=target_user.id)
    return UserSerializer(refreshed_user, context={"request": request}).data


def change_user_password(*, actor: User, target_user_id, payload: dict):
    user = User.objects.filter(id=target_user_id).first()
    if user is None:
        raise NotFound("User not found")

    current_password = payload.get("currentPassword", "") or ""
    new_password = payload["newPassword"]
    validate_password_change_request(
        actor=actor,
        target_user=user,
        current_password=current_password,
        new_password=new_password,
    )
    ensure_valid_password(new_password, user=user, field_name="newPassword")

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return {"detail": "Password updated"}


def save_profile_image_for_user(*, request, user: User):
    ensure_can_upload_profile_image(actor=request.user, target_user=user)

    image = request.FILES.get("image") or request.FILES.get("profile_img")
    if image is None:
        raise ValidationError({"image": "Image file is required"})
    extension, _size = validate_profile_image(
        image,
        max_size_bytes=getattr(settings, "BUGBOARD_MAX_PROFILE_IMAGE_BYTES", 2 * 1024 * 1024),
    )
    saved = store_upload(
        uploaded_file=image,
        storage_dir=f"profile-images/{user.id}",
        filename_suffix=f".{extension}",
    )
    saved_path = saved.path

    profile, _ = UserProfileImage.objects.get_or_create(user=user)
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
