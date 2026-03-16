"""Authentication views: JWT login, refresh, logout, me, OTP, and password reset."""
from __future__ import annotations

import logging
from datetime import datetime, timezone as dt_timezone
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from ...security.authentication import CSRFAwareSessionAuthentication
from ..users.models import RevokedTokenSession
from ..users.serializers import UserSerializer
from .serializers import (
    PasswordOTPRequestSerializer,
    PasswordOTPVerifySerializer,
    PasswordResetSerializer,
)
from ..users.services import issue_otp_for_email, reset_password_with_otp, verify_otp

logger = logging.getLogger(__name__)


def _refresh_cookie_name() -> str:
    return settings.AUTH_REFRESH_COOKIE_NAME


def _refresh_cookie_path() -> str:
    return settings.AUTH_REFRESH_COOKIE_PATH


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(
        _refresh_cookie_name(),
        refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
        path=_refresh_cookie_path(),
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        _refresh_cookie_name(),
        path=_refresh_cookie_path(),
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


def _token_pair_for_user(user: User) -> tuple[str, str]:
    refresh = RefreshToken.for_user(user)
    refresh["sid"] = uuid4().hex
    return str(refresh.access_token), str(refresh)


def _revoke_token_session(*, sid: str | None, user_id: int | None, expires_at_unix: int | None) -> None:
    if not sid or not expires_at_unix:
        return

    expires_at = datetime.fromtimestamp(expires_at_unix, tz=dt_timezone.utc)
    RevokedTokenSession.objects.update_or_create(
        sid=sid,
        defaults={
            "user_id": user_id,
            "expires_at": expires_at,
        },
    )


def _revoke_session_from_refresh(refresh_token: str) -> None:
    try:
        token = RefreshToken(refresh_token)
    except TokenError:
        return

    _revoke_token_session(
        sid=token.get("sid"),
        user_id=token.get("user_id"),
        expires_at_unix=token.get("exp"),
    )


def _revoke_session_from_access(request) -> None:
    authenticator = JWTAuthentication()
    header = authenticator.get_header(request)
    if header is None:
        return

    raw_token = authenticator.get_raw_token(header)
    if raw_token is None:
        return

    try:
        validated_token = authenticator.get_validated_token(raw_token)
    except TokenError:
        return

    _revoke_token_session(
        sid=validated_token.get("sid"),
        user_id=validated_token.get("user_id"),
        expires_at_unix=validated_token.get("exp"),
    )


class CSRFTokenView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CSRFAwareSessionAuthentication]
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

        access_token, refresh_token = _token_pair_for_user(auth_user)
        get_token(request)

        response = Response(
            {
                "accessToken": access_token,
                "user": UserSerializer(auth_user, context={"request": request}).data,
            }
        )
        _set_refresh_cookie(response, refresh_token)
        return response


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CSRFAwareSessionAuthentication]

    def post(self, request):
        refresh_token = request.COOKIES.get(_refresh_cookie_name())
        if not refresh_token:
            return Response({"detail": "Refresh token missing"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response({"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

        get_token(request)
        response = Response({"accessToken": serializer.validated_data["access"]})

        rotated_refresh = serializer.validated_data.get("refresh")
        if rotated_refresh:
            _set_refresh_cookie(response, rotated_refresh)
        return response


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CSRFAwareSessionAuthentication]

    def post(self, request):
        refresh_token = request.COOKIES.get(_refresh_cookie_name())
        if refresh_token:
            _revoke_session_from_refresh(refresh_token)
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                logger.info("logout_with_invalid_refresh_token")

        _revoke_session_from_access(request)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        get_token(request)
        return Response(UserSerializer(request.user, context={"request": request}).data)


class PasswordOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CSRFAwareSessionAuthentication]
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
    authentication_classes = [CSRFAwareSessionAuthentication]
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
    authentication_classes = [CSRFAwareSessionAuthentication]
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
