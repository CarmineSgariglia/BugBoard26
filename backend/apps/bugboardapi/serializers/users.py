from django.contrib.auth.models import User
from rest_framework import serializers

from ..models import UserProfile
from ..utils import build_media_url


class UserSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="id", read_only=True)
    firstName = serializers.CharField(source="first_name", required=False, allow_blank=True)
    lastName = serializers.CharField(source="last_name", required=False, allow_blank=True)
    isAdmin = serializers.BooleanField(source="profile.is_admin", required=False)
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
            "isAdmin",
            "profileImg",
            "active",
        ]
        extra_kwargs = {"password": {"write_only": True, "required": False}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["profileImg"] = build_media_url(self, data.get("profileImg", ""))
        return data

    def create(self, validated_data):
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.is_admin = profile_data.get("is_admin", profile.is_admin)
        profile.profile_img = profile_data.get("profile_img", profile.profile_img)
        profile.active = validated_data.get("is_active", profile.active)
        profile.save()
        user.is_staff = profile.is_admin
        user.save(update_fields=["is_staff"])
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if "is_admin" in profile_data:
            profile.is_admin = profile_data["is_admin"]
            instance.is_staff = profile.is_admin
            instance.save(update_fields=["is_staff"])
        if "profile_img" in profile_data:
            profile.profile_img = profile_data["profile_img"]
        profile.active = instance.is_active
        profile.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=False, allow_blank=True)
    newPassword = serializers.CharField(min_length=8)
