"""Authentication views: login, logout, me, OTP, and password reset."""
from __future__ import annotations

import logging

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..serializers import (
    PasswordOTPRequestSerializer,
    PasswordOTPVerifySerializer,
    PasswordResetSerializer,
    UserSerializer,
)
from ..services.password_reset import issue_otp_for_email, reset_password_with_otp, verify_otp

logger = logging.getLogger(__name__)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")
        user = User.objects.filter(email__iexact=email).first()
        username = user.username if user else ""
        auth_user = authenticate(request, username=username, password=password)
        if auth_user is None or not auth_user.is_active:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, auth_user)
        get_token(request)
        return Response(UserSerializer(auth_user, context={"request": request}).data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        get_token(request)
        return Response(UserSerializer(request.user, context={"request": request}).data)


class PasswordOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"

    def post(self, request):
        serializer = PasswordOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        issue_otp_for_email(email)
        return Response({"detail": "If the email exists, an OTP has been sent."})


class PasswordOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"

    def post(self, request):
        serializer = PasswordOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        valid, expires_at = verify_otp(email=email, code=code)
        if not valid:
            return Response({"valid": False})
        return Response({"valid": True, "expiresAt": expires_at})


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["newPassword"]
        changed = reset_password_with_otp(email=email, code=code, new_password=new_password)
        if not changed:
            return Response({"detail": "Invalid or expired OTP"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Password reset completed"})
