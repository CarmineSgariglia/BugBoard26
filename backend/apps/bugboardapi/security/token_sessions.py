from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from uuid import uuid4

from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from ..modules.users.models import RevokedTokenSession


def build_token_pair_for_user(user) -> tuple[str, str]:
    refresh = RefreshToken.for_user(user)
    refresh["sid"] = uuid4().hex
    return str(refresh.access_token), str(refresh)


def revoke_token_session(*, sid: str | None, user_id: int | None, expires_at_unix: int | None) -> None:
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


def revoke_session_from_refresh(refresh_token: str) -> None:
    try:
        token = RefreshToken(refresh_token)
    except TokenError:
        return

    revoke_token_session(
        sid=token.get("sid"),
        user_id=token.get("user_id"),
        expires_at_unix=token.get("exp"),
    )


def revoke_session_from_access(request) -> None:
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

    revoke_token_session(
        sid=validated_token.get("sid"),
        user_id=validated_token.get("user_id"),
        expires_at_unix=validated_token.get("exp"),
    )


def is_token_session_revoked(sid: str | None) -> bool:
    if not sid:
        return False
    return RevokedTokenSession.objects.filter(sid=sid, expires_at__gt=timezone.now()).exists()
