from rest_framework import serializers

from ..users.serializers import UserReadSerializer


class PasswordOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordOTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")
    newPassword = serializers.CharField(min_length=8)


class CSRFTokenResponseSerializer(serializers.Serializer):
    csrfToken = serializers.CharField()


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class LoginResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()
    user = UserReadSerializer()


class RefreshResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()


class DetailResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()


class PasswordOTPVerifyResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    expiresAt = serializers.DateTimeField(required=False, allow_null=True)
