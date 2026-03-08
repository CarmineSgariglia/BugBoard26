from django.contrib.auth.models import User
from rest_framework import serializers

from ..models import UserProfileImage
from ..passwords import build_password_validation_user, ensure_valid_password
from ..roles import (
    ADMIN_GROUP_NAME,
    DEVELOPER_GROUP_NAME,
    GLOBAL_ROLE_CHOICES,
    assign_global_role,
    get_global_role,
)
from ..utils import build_media_url


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
        role_name = validated_data.pop("group", DEVELOPER_GROUP_NAME)
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
        assign_global_role(user, role_name)
        user_update_fields = ["is_staff"]
        if password:
            user_update_fields.append("password")
        user.save(update_fields=user_update_fields)
        profile, _ = UserProfileImage.objects.get_or_create(user=user)
        profile.profile_img = profile_data.get("profile_img", profile.profile_img)
        profile.save(update_fields=["profile_img"])
        return user

    def update(self, instance, validated_data):
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
            instance.save(update_fields=update_fields)

        profile, _ = UserProfileImage.objects.get_or_create(user=instance)
        if "profile_img" in profile_data:
            profile.profile_img = profile_data["profile_img"]
            profile.save(update_fields=["profile_img"])
        if role_name is not None:
            assign_global_role(instance, role_name)
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=False, allow_blank=True)
    newPassword = serializers.CharField(min_length=8)
