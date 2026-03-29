from __future__ import annotations

import logging
import secrets
import string
from typing import Callable

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError

from ...roles import ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME, assign_global_role
from ...security.passwords import build_password_validation_user, ensure_valid_password
from ...security.token_sessions import set_user_password
from ...security.uploads import compress_image_upload, store_upload, validate_profile_image
from .email_delivery import (
    UserOnboardingEmailDeliveryFailed,
    user_onboarding_email_service,
)
from .models import UserProfileImage
from .policies import (
    ensure_can_upload_profile_image,
    validate_admin_password_reset_request,
    validate_self_password_change_request,
)

logger = logging.getLogger(__name__)

EMAIL_ALREADY_IN_USE_MESSAGE = "Email already in use"
EMAIL_CASE_INSENSITIVE_INDEX_NAME = "auth_user_email_ci_unique_idx"
TEMP_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%^&*"
TEMP_PASSWORD_LENGTH = 16
TEMP_PASSWORD_SPECIALS = "!@#$%^&*"
USERNAME_ALREADY_EXISTS_MESSAGE = "A user with that username already exists."
USERNAME_UNIQUE_CONSTRAINT_NAME = "auth_user_username_key"


def delete_stored_file(path: str) -> None:
    try:
        default_storage.delete(path)
    except Exception:
        logger.warning("Failed to delete stored file: %s", path)


class UserService:
    def __init__(self, *, onboarding_email_service=user_onboarding_email_service) -> None:
        self._onboarding_email_service = onboarding_email_service

    def filter_queryset(
        self,
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

    def change_current_user_password(self, *, actor: User, payload: dict) -> dict[str, str]:
        user = self._get_target_user_or_404(target_user_id=actor.id)
        new_password = payload["newPassword"]
        validate_self_password_change_request(
            actor=actor,
            target_user=user,
            current_password=payload.get("currentPassword", "") or "",
            new_password=new_password,
        )
        return self._update_password(user=user, new_password=new_password)

    def reset_user_password(
        self,
        *,
        actor: User,
        target_user_id: int,
        payload: dict,
    ) -> dict[str, str]:
        user = self._get_target_user_or_404(target_user_id=target_user_id)
        new_password = payload["newPassword"]
        validate_admin_password_reset_request(
            actor=actor,
            target_user=user,
            new_password=new_password,
        )
        return self._update_password(user=user, new_password=new_password)

    def save_profile_image(
        self,
        *,
        request,
        user: User,
        validate_image: Callable[..., tuple[str, int]] | None = None,
        compress_upload: Callable[..., object] | None = None,
        store_upload_file: Callable[..., object] | None = None,
        delete_stored_file_func: Callable[[str], None] | None = None,
    ):
        ensure_can_upload_profile_image(actor=request.user, target_user=user)

        image = request.FILES.get("image") or request.FILES.get("profile_img")
        if image is None:
            raise ValidationError({"image": "Image file is required"})

        validate_image = validate_image or validate_profile_image
        compress_upload = compress_upload or compress_image_upload
        store_upload_file = store_upload_file or store_upload
        cleanup_file = delete_stored_file_func or delete_stored_file

        extension, _size = validate_image(
            image,
            max_size_bytes=getattr(settings, "BUGBOARD_MAX_PROFILE_IMAGE_BYTES", 2 * 1024 * 1024),
        )
        prepared_image = compress_upload(
            uploaded_file=image,
            max_width=1024,
            max_height=1024,
            target_max_bytes=getattr(settings, "BUGBOARD_MAX_PROFILE_IMAGE_BYTES", 2 * 1024 * 1024),
            field_name="image",
        )
        saved = store_upload_file(
            uploaded_file=prepared_image.file,
            storage_dir=f"profile-images/{user.id}",
            filename_suffix=prepared_image.extension or f".{extension}",
        )
        saved_path = saved.path

        try:
            with transaction.atomic():
                profile, _ = UserProfileImage.objects.get_or_create(user=user)
                old_path = profile.profile_img
                profile.profile_img = saved_path
                profile.save(update_fields=["profile_img"])

                if old_path and old_path != saved_path and old_path.startswith("profile-images/"):
                    transaction.on_commit(lambda path=old_path: cleanup_file(path))
        except Exception:
            if saved_path and saved_path.startswith("profile-images/"):
                cleanup_file(saved_path)
            raise

        return User.objects.get(id=user.id)

    def create_from_validated_data(
        self,
        validated_data: dict,
        *,
        assign_role: Callable[[User, str], None] | None = None,
        save_profile_image_record: Callable[..., None] | None = None,
        send_credentials_email: Callable[..., None] | None = None,
        raise_integrity_error: Callable[[IntegrityError], None] | None = None,
    ) -> User:
        validated_data = validated_data.copy()
        role_name = validated_data.pop("group", DEVELOPER_GROUP_NAME)
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None) or self._generate_temporary_password(
            user_attrs=validated_data
        )
        assign_role = assign_role or assign_global_role
        save_profile = save_profile_image_record or self._save_profile_image
        send_credentials_email = (
            send_credentials_email or self._onboarding_email_service.send_credentials_email
        )
        integrity_handler = raise_integrity_error or self.raise_known_integrity_error

        try:
            with transaction.atomic():
                user = User.objects.create(**validated_data)
                user.set_password(password)
                assign_role(user, role_name)
                user.save(update_fields=["is_staff", "password"])
                save_profile(user=user, profile_data=profile_data, create=True)
                transaction.on_commit(
                    lambda created_user=user, temporary_password=password: self._deliver_new_user_credentials_email(
                        user=created_user,
                        temporary_password=temporary_password,
                        send_credentials_email=send_credentials_email,
                    )
                )
        except IntegrityError as exc:
            integrity_handler(exc)
        return user

    def update_from_validated_data(
        self,
        instance: User,
        validated_data: dict,
        *,
        assign_role: Callable[[User, str], None] | None = None,
        save_profile_image_record: Callable[..., None] | None = None,
        raise_integrity_error: Callable[[IntegrityError], None] | None = None,
    ) -> User:
        validated_data = validated_data.copy()
        role_name = validated_data.pop("group", None)
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        assign_role = assign_role or assign_global_role
        save_profile = save_profile_image_record or self._save_profile_image
        integrity_handler = raise_integrity_error or self.raise_known_integrity_error

        try:
            with transaction.atomic():
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                if password:
                    instance.set_password(password)

                update_fields = list(validated_data.keys())
                if password:
                    update_fields.append("password")
                if update_fields:
                    instance.save(update_fields=update_fields)

                save_profile(user=instance, profile_data=profile_data, create=False)
                if role_name is not None:
                    assign_role(instance, role_name)
        except IntegrityError as exc:
            integrity_handler(exc)
        return instance

    def raise_known_integrity_error(self, exc: IntegrityError) -> None:
        constraint_name = getattr(getattr(exc.__cause__, "diag", None), "constraint_name", "")
        if (
            constraint_name == USERNAME_UNIQUE_CONSTRAINT_NAME
            or USERNAME_UNIQUE_CONSTRAINT_NAME in str(exc)
        ):
            raise serializers.ValidationError({"username": USERNAME_ALREADY_EXISTS_MESSAGE}) from exc
        if (
            constraint_name == EMAIL_CASE_INSENSITIVE_INDEX_NAME
            or EMAIL_CASE_INSENSITIVE_INDEX_NAME in str(exc)
        ):
            raise serializers.ValidationError({"email": EMAIL_ALREADY_IN_USE_MESSAGE}) from exc
        raise exc

    def _get_target_user_or_404(self, *, target_user_id: int) -> User:
        user = User.objects.filter(id=target_user_id).first()
        if user is None:
            raise NotFound("User not found")
        return user

    def _update_password(self, *, user: User, new_password: str) -> dict[str, str]:
        ensure_valid_password(new_password, user=user, field_name="newPassword")
        with transaction.atomic():
            set_user_password(user=user, new_password=new_password)
        return {"detail": "Password updated"}

    def _save_profile_image(self, *, user: User, profile_data: dict, create: bool) -> None:
        profile, _ = UserProfileImage.objects.get_or_create(user=user)
        if create:
            profile.profile_img = profile_data.get("profile_img", profile.profile_img)
            profile.save(update_fields=["profile_img"])
            return

        if "profile_img" not in profile_data:
            return
        profile.profile_img = profile_data["profile_img"]
        profile.save(update_fields=["profile_img"])

    def _build_temporary_password_candidate(self) -> str:
        required_chars = [
            secrets.choice(string.ascii_lowercase),
            secrets.choice(string.ascii_uppercase),
            secrets.choice(string.digits),
            secrets.choice(TEMP_PASSWORD_SPECIALS),
        ]
        remaining_length = TEMP_PASSWORD_LENGTH - len(required_chars)
        candidate_chars = required_chars + [
            secrets.choice(TEMP_PASSWORD_ALPHABET) for _ in range(remaining_length)
        ]
        for index in range(len(candidate_chars) - 1, 0, -1):
            swap_index = secrets.randbelow(index + 1)
            candidate_chars[index], candidate_chars[swap_index] = (
                candidate_chars[swap_index],
                candidate_chars[index],
            )
        return "".join(candidate_chars)

    def _generate_temporary_password(self, *, user_attrs: dict) -> str:
        candidate_user = build_password_validation_user(attrs=user_attrs)
        for _ in range(10):
            password = self._build_temporary_password_candidate()
            try:
                ensure_valid_password(password, user=candidate_user, field_name="password")
            except serializers.ValidationError:
                continue
            return password
        raise RuntimeError("Unable to generate a valid temporary password")

    def _deliver_new_user_credentials_email(
        self,
        *,
        user: User,
        temporary_password: str,
        send_credentials_email: Callable[..., None],
    ) -> None:
        try:
            send_credentials_email(
                email=user.email,
                username=user.username,
                temporary_password=temporary_password,
                first_name=user.first_name,
                last_name=user.last_name,
            )
        except Exception as exc:
            raise UserOnboardingEmailDeliveryFailed() from exc

user_service = UserService()
