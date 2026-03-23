import secrets
import string

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework import serializers

from ...roles import DEVELOPER_GROUP_NAME, assign_global_role
from ...security.passwords import build_password_validation_user, ensure_valid_password
from .email_delivery import (
    UserOnboardingEmailDeliveryFailed,
    send_new_user_credentials_email,
)
from .profile_models import UserProfileImage

EMAIL_ALREADY_IN_USE_MESSAGE = "Email already in use"
EMAIL_CASE_INSENSITIVE_INDEX_NAME = "auth_user_email_ci_unique_idx"
USERNAME_ALREADY_EXISTS_MESSAGE = "A user with that username already exists."
USERNAME_UNIQUE_CONSTRAINT_NAME = "auth_user_username_key"
TEMP_PASSWORD_LENGTH = 16
TEMP_PASSWORD_SPECIALS = "!@#$%^&*"
TEMP_PASSWORD_ALPHABET = string.ascii_letters + string.digits + TEMP_PASSWORD_SPECIALS


def raise_known_user_integrity_error(exc: IntegrityError) -> None:
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


def _save_profile_image(*, user: User, profile_data: dict, create: bool) -> None:
    profile, _ = UserProfileImage.objects.get_or_create(user=user)
    if create:
        profile.profile_img = profile_data.get("profile_img", profile.profile_img)
        profile.save(update_fields=["profile_img"])
        return

    if "profile_img" not in profile_data:
        return
    profile.profile_img = profile_data["profile_img"]
    profile.save(update_fields=["profile_img"])


def _build_temporary_password_candidate() -> str:
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
    for i in range(len(candidate_chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        candidate_chars[i], candidate_chars[j] = candidate_chars[j], candidate_chars[i]
    return "".join(candidate_chars)


def _generate_temporary_password(*, user_attrs: dict) -> str:
    candidate_user = build_password_validation_user(attrs=user_attrs)
    for _ in range(10):
        password = _build_temporary_password_candidate()
        try:
            ensure_valid_password(password, user=candidate_user, field_name="password")
        except serializers.ValidationError:
            continue
        return password
    raise RuntimeError("Unable to generate a valid temporary password")


def _deliver_new_user_credentials_email(*, user: User, temporary_password: str) -> None:
    try:
        send_new_user_credentials_email(
            email=user.email,
            username=user.username,
            temporary_password=temporary_password,
            first_name=user.first_name,
            last_name=user.last_name,
        )
    except Exception as exc:
        raise UserOnboardingEmailDeliveryFailed() from exc


def create_user_from_validated_data(validated_data: dict) -> User:
    validated_data = validated_data.copy()
    role_name = validated_data.pop("group", DEVELOPER_GROUP_NAME)
    profile_data = validated_data.pop("profile", {})
    password = validated_data.pop("password", None) or _generate_temporary_password(
        user_attrs=validated_data
    )
    try:
        with transaction.atomic():
            user = User.objects.create(**validated_data)
            user.set_password(password)
            assign_global_role(user, role_name)
            user_update_fields = ["is_staff", "password"]
            user.save(update_fields=user_update_fields)
            _save_profile_image(user=user, profile_data=profile_data, create=True)
            transaction.on_commit(
                lambda created_user=user, temporary_password=password: _deliver_new_user_credentials_email(
                    user=created_user,
                    temporary_password=temporary_password,
                )
            )
    except IntegrityError as exc:
        raise_known_user_integrity_error(exc)
    return user


def update_user_from_validated_data(instance: User, validated_data: dict) -> User:
    validated_data = validated_data.copy()
    role_name = validated_data.pop("group", None)
    profile_data = validated_data.pop("profile", {})
    password = validated_data.pop("password", None)

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

            _save_profile_image(user=instance, profile_data=profile_data, create=False)
            if role_name is not None:
                assign_global_role(instance, role_name)
    except IntegrityError as exc:
        raise_known_user_integrity_error(exc)
    return instance
