"""Authentication views: JWT login, refresh, logout, me, OTP, and password reset."""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from ...security.authentication import CSRFAwareSessionAuthentication
from ...security.token_sessions import (
    build_token_pair_for_user,
    is_refresh_token_password_stale,
    is_refresh_token_session_revoked,
    revoke_session_from_access,
    revoke_session_from_refresh,
)
from ..auth.password_reset import issue_otp_for_email, reset_password_with_otp, verify_otp
from ..users.serializers import UserReadSerializer
from .serializers import (
    CSRFTokenResponseSerializer,
    DetailResponseSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    PasswordOTPRequestSerializer,
    PasswordOTPVerifyResponseSerializer,
    PasswordOTPVerifySerializer,
    PasswordResetSerializer,
    RefreshResponseSerializer,
)

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


class CSRFTokenView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        tags=["Security"],
        summary="Get CSRF token",
        description="Bootstraps the CSRF cookie used by cookie-backed session mutations.",
        responses=CSRFTokenResponseSerializer,
    )
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CSRFAwareSessionAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        tags=["Sessions"],
        summary="Create session",
        description="Authenticates the user, returns an access token, and sets the refresh token in an HTTP-only cookie.",
        request=LoginRequestSerializer,
        responses={200: LoginResponseSerializer, 401: DetailResponseSerializer},
    )
    def post(self, request):
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")
        user = User.objects.filter(email__iexact=email).first()
        username = user.username if user else ""
        auth_user = authenticate(request, username=username, password=password)
        if auth_user is None or not auth_user.is_active:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        access_token, refresh_token = build_token_pair_for_user(auth_user)
        get_token(request)

        response = Response(
            {
                "accessToken": access_token,
                "user": UserReadSerializer(auth_user, context={"request": request}).data,
            }
        )
        _set_refresh_cookie(response, refresh_token)
        return response


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CSRFAwareSessionAuthentication]

    @extend_schema(
        tags=["Sessions"],
        summary="Refresh access token",
        description="Reads the refresh token from the HTTP-only cookie and returns a new access token.",
        request=None,
        responses={200: RefreshResponseSerializer, 401: DetailResponseSerializer},
    )
    def post(self, request):
        refresh_token = request.COOKIES.get(_refresh_cookie_name())
        if not refresh_token:
            return Response({"detail": "Refresh token missing"}, status=status.HTTP_401_UNAUTHORIZED)
        if is_refresh_token_session_revoked(refresh_token) or is_refresh_token_password_stale(
            refresh_token
        ):
            return Response({"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

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

    @extend_schema(
        tags=["Sessions"],
        summary="Logout",
        description="Revokes the current server-side JWT session and clears the refresh cookie.",
        request=None,
        responses={204: OpenApiResponse(description="Logged out")},
    )
    def delete(self, request):
        refresh_token = request.COOKIES.get(_refresh_cookie_name())
        if refresh_token:
            revoke_session_from_refresh(refresh_token)
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                logger.info("logout_with_invalid_refresh_token")

        revoke_session_from_access(request)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Users"],
        summary="Get current user",
        description="Returns the authenticated user profile.",
        responses=UserReadSerializer,
    )
    def get(self, request):
        get_token(request)
        return Response(UserReadSerializer(request.user, context={"request": request}).data)


class PasswordOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CSRFAwareSessionAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"

    @extend_schema(
        tags=["Passwords"],
        summary="Request password reset OTP",
        description="Starts the OTP-based password reset flow.",
        request=PasswordOTPRequestSerializer,
        responses=DetailResponseSerializer,
    )
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

    @extend_schema(
        tags=["Passwords"],
        summary="Verify password reset OTP",
        description="Validates a password reset OTP.",
        request=PasswordOTPVerifySerializer,
        responses=PasswordOTPVerifyResponseSerializer,
    )
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

    @extend_schema(
        tags=["Passwords"],
        summary="Reset password with OTP",
        description="Completes the OTP-based password reset flow.",
        request=PasswordResetSerializer,
        responses={200: DetailResponseSerializer, 400: DetailResponseSerializer},
    )
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
