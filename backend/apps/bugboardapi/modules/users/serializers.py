from django.contrib.auth.models import User
from rest_framework import serializers

from ...common.media import build_media_url
from ...roles import (
    ADMIN_GROUP_NAME,
    DEVELOPER_GROUP_NAME,
    GLOBAL_ROLE_CHOICES,
    get_global_role,
)
from ...security.passwords import build_password_validation_user, ensure_valid_password
from .mutations import (
    EMAIL_ALREADY_IN_USE_MESSAGE,
    USERNAME_ALREADY_EXISTS_MESSAGE,
    create_user_from_validated_data,
    update_user_from_validated_data,
)


class UserReadSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="id", read_only=True)
    firstName = serializers.CharField(source="first_name", read_only=True)
    lastName = serializers.CharField(source="last_name", read_only=True)
    group = serializers.SerializerMethodField()
    isAdmin = serializers.SerializerMethodField()
    profileImg = serializers.SerializerMethodField()
    active = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model = User
        fields = [
            "userId",
            "username",
            "email",
            "firstName",
            "lastName",
            "group",
            "isAdmin",
            "profileImg",
            "active",
        ]

    def get_group(self, instance):
        role = get_global_role(instance) or DEVELOPER_GROUP_NAME
        return role

    def get_isAdmin(self, instance):
        return self.get_group(instance) == ADMIN_GROUP_NAME

    def get_profileImg(self, instance):
        profile = getattr(instance, "profile", None)
        profile_img = getattr(profile, "profile_img", "") if profile is not None else ""
        return build_media_url(self, profile_img)


class UserMutationSerializer(UserReadSerializer):
    firstName = serializers.CharField(source="first_name", required=False, allow_blank=True)
    lastName = serializers.CharField(source="last_name", required=False, allow_blank=True)
    isAdmin = serializers.BooleanField(required=False, write_only=True)
    group = serializers.ChoiceField(choices=GLOBAL_ROLE_CHOICES, required=False, write_only=True)
    profileImg = serializers.CharField(source="profile.profile_img", required=False, allow_blank=True)
    active = serializers.BooleanField(source="is_active", required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta(UserReadSerializer.Meta):
        fields = [
            "userId",
            "username",
            "email",
            "firstName",
            "lastName",
            "password",
            "group",
            "isAdmin",
            "profileImg",
            "active",
        ]

    def to_representation(self, instance):
        return UserReadSerializer(instance, context=self.context).data

    def validate_email(self, value: str) -> str:
        normalized_email = value.strip()
        if not normalized_email:
            return normalized_email

        queryset = User.objects.filter(email__iexact=normalized_email)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(EMAIL_ALREADY_IN_USE_MESSAGE)
        return normalized_email

    def validate_username(self, value: str) -> str:
        queryset = User.objects.filter(username=value)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(USERNAME_ALREADY_EXISTS_MESSAGE)
        return value

    def validate(self, attrs):
        password = attrs.get("password")
        attrs["group"] = _resolve_requested_group(
            requested_group=attrs.get("group"),
            requested_is_admin=attrs.pop("isAdmin", None),
            default_group=DEVELOPER_GROUP_NAME if self.instance is None else None,
        )
        _validate_user_mutation_password(
            instance=self.instance,
            attrs=attrs,
            password=password,
        )
        return attrs

    def create(self, validated_data):
        return create_user_from_validated_data(validated_data)

    def update(self, instance, validated_data):
        return update_user_from_validated_data(instance, validated_data)


class UserSerializer(UserReadSerializer):
    pass


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=False, allow_blank=True)
    newPassword = serializers.CharField(min_length=8)


def _resolve_requested_group(
    *,
    requested_group,
    requested_is_admin,
    default_group,
):
    resolved_group = requested_group
    if requested_is_admin is not None:
        alias_group = ADMIN_GROUP_NAME if requested_is_admin else DEVELOPER_GROUP_NAME
        if resolved_group is not None and resolved_group != alias_group:
            raise serializers.ValidationError({"group": "group and isAdmin must describe the same role"})
        resolved_group = alias_group

    if resolved_group is not None:
        return resolved_group
    return default_group


def _validate_user_mutation_password(*, instance, attrs: dict, password: str | None) -> None:
    if instance is None and not password:
        raise serializers.ValidationError({"password": "Password is required"})

    if instance is not None and password is not None:
        raise serializers.ValidationError({"password": "Use the dedicated password endpoint"})

    if not password:
        return

    candidate_user = build_password_validation_user(instance=instance, attrs=attrs)
    ensure_valid_password(password, user=candidate_user, field_name="password")
