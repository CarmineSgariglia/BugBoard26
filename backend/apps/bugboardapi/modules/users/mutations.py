from django.contrib.auth.models import User
from django.db import IntegrityError
from rest_framework import serializers

from ...roles import DEVELOPER_GROUP_NAME, assign_global_role
from .models import UserProfileImage

EMAIL_ALREADY_IN_USE_MESSAGE = "Email already in use"
EMAIL_CASE_INSENSITIVE_INDEX_NAME = "auth_user_email_ci_unique_idx"
USERNAME_ALREADY_EXISTS_MESSAGE = "A user with that username already exists."
USERNAME_UNIQUE_CONSTRAINT_NAME = "auth_user_username_key"


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


def create_user_from_validated_data(validated_data: dict) -> User:
    role_name = validated_data.pop("group", DEVELOPER_GROUP_NAME)
    profile_data = validated_data.pop("profile", {})
    password = validated_data.pop("password", None)
    try:
        user = User.objects.create(**validated_data)
    except IntegrityError as exc:
        raise_known_user_integrity_error(exc)
    if password:
        user.set_password(password)
    assign_global_role(user, role_name)
    user_update_fields = ["is_staff"]
    if password:
        user_update_fields.append("password")
    try:
        user.save(update_fields=user_update_fields)
    except IntegrityError as exc:
        raise_known_user_integrity_error(exc)
    _save_profile_image(user=user, profile_data=profile_data, create=True)
    return user


def update_user_from_validated_data(instance: User, validated_data: dict) -> User:
    role_name = validated_data.pop("group", None)
    profile_data = validated_data.pop("profile", {})
    password = validated_data.pop("password", None)

    for attr, value in validated_data.items():
        setattr(instance, attr, value)
    if password:
        instance.set_password(password)

    update_fields = list(validated_data.keys())
    if password:
        update_fields.append("password")
    if update_fields:
        try:
            instance.save(update_fields=update_fields)
        except IntegrityError as exc:
            raise_known_user_integrity_error(exc)

    _save_profile_image(user=instance, profile_data=profile_data, create=False)
    if role_name is not None:
        assign_global_role(instance, role_name)
    return instance
