from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from typing import TYPE_CHECKING
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password

from ..modules.users.token_session_models import RevokedTokenSession

if TYPE_CHECKING:
    from django.contrib.auth.models import User
    from django.http import HttpRequest


def build_token_pair_for_user(user: User) -> tuple[str, str]:
    refresh = RefreshToken.for_user(user)
    refresh["sid"] = uuid4().hex
    return str(refresh.access_token), str(refresh)


def set_user_password(*, user: User, new_password: str) -> None:
    user.set_password(new_password)
    user.save(update_fields=["password"])


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


def _parse_refresh_token(refresh_token: str) -> RefreshToken | None:
    try:
        return RefreshToken(refresh_token)
    except TokenError:
        return None


def revoke_session_from_refresh(refresh_token: str) -> None:
    token = _parse_refresh_token(refresh_token)
    if token is None:
        return

    revoke_token_session(
        sid=token.get("sid"),
        user_id=token.get("user_id"),
        expires_at_unix=token.get("exp"),
    )


def is_refresh_token_session_revoked(refresh_token: str) -> bool:
    token = _parse_refresh_token(refresh_token)
    if token is None:
        return False

    return is_token_session_revoked(token.get("sid"))


def is_refresh_token_password_stale(refresh_token: str) -> bool:
    if not api_settings.CHECK_REVOKE_TOKEN:
        return False

    token = _parse_refresh_token(refresh_token)
    if token is None:
        return False

    user_id = token.get(api_settings.USER_ID_CLAIM)
    if user_id is None:
        return False

    user_model = get_user_model()
    try:
        user = user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
    except user_model.DoesNotExist:
        return False

    return token.get(api_settings.REVOKE_TOKEN_CLAIM) != get_md5_hash_password(user.password)


def _validated_access_token_from_request(request: HttpRequest):
    authenticator = JWTAuthentication()
    header = authenticator.get_header(request)
    if header is None:
        return None

    raw_token = authenticator.get_raw_token(header)
    if raw_token is None:
        return None

    try:
        return authenticator.get_validated_token(raw_token)
    except TokenError:
        return None


def revoke_session_from_access(request: HttpRequest) -> None:
    validated_token = _validated_access_token_from_request(request)
    if validated_token is None:
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
