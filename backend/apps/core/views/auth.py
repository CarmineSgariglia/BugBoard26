"""Authentication views: login, logout, me, OTP, and password reset."""
from __future__ import annotations

import logging
import random
from datetime import timedelta

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..models import PasswordResetOTP
from ..serializers import (
    PasswordOTPRequestSerializer,
    PasswordOTPVerifySerializer,
    PasswordResetSerializer,
    UserSerializer,
)

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
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"detail": "If the email exists, an OTP has been sent."})

        code = f"{random.randint(0, 999999):06d}"
        PasswordResetOTP.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        send_mail(
            subject="BugBoard26 OTP Reset",
            message=f"Your OTP code is {code}. It expires in 5 minutes.",
            from_email=None,
            recipient_list=[email],
            fail_silently=True,
        )
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

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"valid": False})

        otp = (
            PasswordResetOTP.objects.filter(user=user, code=code, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp or not otp.is_valid():
            return Response({"valid": False})
        return Response({"valid": True, "expiresAt": otp.expires_at})


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

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

        otp = (
            PasswordResetOTP.objects.filter(user=user, code=code, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp or not otp.is_valid():
            return Response({"detail": "Invalid or expired OTP"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        return Response({"detail": "Password reset completed"})
