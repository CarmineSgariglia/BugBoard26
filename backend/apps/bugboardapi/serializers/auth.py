from rest_framework import serializers


class PasswordOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordOTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")
    newPassword = serializers.CharField(min_length=8)
