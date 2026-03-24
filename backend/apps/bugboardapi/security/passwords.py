from __future__ import annotations

from collections.abc import Mapping

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

# Helper function to build a User instance for password validation, using provided attributes or existing instance data
def build_password_validation_user(
    *,
    instance: User | None = None,
    attrs: Mapping[str, str] | None = None,
) -> User:
    attrs = attrs or {}
    user = instance or User()
    user.username = attrs.get("username", getattr(user, "username", ""))
    user.email = attrs.get("email", getattr(user, "email", ""))
    user.first_name = attrs.get("first_name", getattr(user, "first_name", ""))
    user.last_name = attrs.get("last_name", getattr(user, "last_name", ""))
    return user

# Helper function to validate a password against Django's validators, raising a DRF ValidationError with field-specific messages if validation fails
def ensure_valid_password(
    password: str,
    *,
    user: User | None = None,
    field_name: str = "password",
) -> None:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({field_name: list(exc.messages)}) from exc
