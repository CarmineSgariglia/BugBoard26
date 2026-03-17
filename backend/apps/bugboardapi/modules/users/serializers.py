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


class UserSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="id", read_only=True)
    firstName = serializers.CharField(source="first_name", required=False, allow_blank=True)
    lastName = serializers.CharField(source="last_name", required=False, allow_blank=True)
    isAdmin = serializers.BooleanField(required=False, write_only=True)
    group = serializers.ChoiceField(choices=GLOBAL_ROLE_CHOICES, required=False, write_only=True)
    profileImg = serializers.CharField(source="profile.profile_img", required=False, allow_blank=True)
    active = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = User
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
        extra_kwargs = {"password": {"write_only": True, "required": False}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["profileImg"] = build_media_url(self, data.get("profileImg", ""))
        role = get_global_role(instance) or DEVELOPER_GROUP_NAME
        data["group"] = role
        data["isAdmin"] = role == ADMIN_GROUP_NAME
        return data

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
        requested_group = attrs.get("group")
        requested_is_admin = attrs.pop("isAdmin", None)
        password = attrs.get("password")

        if requested_is_admin is not None:
            alias_group = ADMIN_GROUP_NAME if requested_is_admin else DEVELOPER_GROUP_NAME
            if requested_group is not None and requested_group != alias_group:
                raise serializers.ValidationError({"group": "group and isAdmin must describe the same role"})
            requested_group = alias_group

        if requested_group is not None:
            attrs["group"] = requested_group
        elif self.instance is None:
            attrs["group"] = DEVELOPER_GROUP_NAME

        if self.instance is None and not password:
            raise serializers.ValidationError({"password": "Password is required"})

        if self.instance is not None and password is not None:
            raise serializers.ValidationError({"password": "Use the dedicated password endpoint"})

        if password:
            candidate_user = build_password_validation_user(instance=self.instance, attrs=attrs)
            ensure_valid_password(password, user=candidate_user, field_name="password")

        return attrs

    def create(self, validated_data):
        return create_user_from_validated_data(validated_data)

    def update(self, instance, validated_data):
        return update_user_from_validated_data(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=False, allow_blank=True)
    newPassword = serializers.CharField(min_length=8)
