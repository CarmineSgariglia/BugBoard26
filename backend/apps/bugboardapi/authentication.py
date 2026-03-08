from __future__ import annotations

from django.utils import timezone
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import RevokedTokenSession


class CSRFAwareSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        self.enforce_csrf(request)
        return None


class RevocableJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        sid = validated_token.get("sid")
        if sid and RevokedTokenSession.objects.filter(sid=sid, expires_at__gt=timezone.now()).exists():
            raise AuthenticationFailed("Token session has been revoked")

        return user, validated_token
