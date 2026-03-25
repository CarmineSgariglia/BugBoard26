"""Password reset OTP workflow."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import EmailMessage, send_mail
from django.db import transaction
from django.utils import timezone

from ...security.passwords import ensure_valid_password
from ...security.token_sessions import set_user_password
from ..users.password_reset_models import PasswordResetOTP

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
PRODUCT_NAME = "BugBoard26"


def _email_hash(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:12]


def _find_active_user_by_email(email: str) -> User | None:
    return User.objects.filter(email__iexact=email.strip(), is_active=True).first()


def _send_otp_email(*, email: str, code: str) -> None:
    provider = getattr(settings, "EMAIL_PROVIDER", "console").lower()
    if provider == "brevo":
        template_id = getattr(settings, "BREVO_OTP_TEMPLATE_ID", "")
        if not template_id:
            raise RuntimeError("BREVO_OTP_TEMPLATE_ID is required when EMAIL_PROVIDER=brevo")
        message = EmailMessage(
            subject="",
            body="",
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        message.template_id = int(template_id)
        message.merge_global_data = {
            "otp_code": code,
            "expiry_minutes": OTP_EXPIRY_MINUTES,
            "product_name": PRODUCT_NAME,
        }
        sender_name = getattr(settings, "BREVO_SENDER_NAME", "").strip()
        if sender_name:
            message.from_email = f"{sender_name} <{settings.DEFAULT_FROM_EMAIL}>"
        message.send(fail_silently=False)
        return

    send_mail(
        subject="BugBoard26 OTP Reset",
        message=f"Your OTP code is {code}. It expires in {OTP_EXPIRY_MINUTES} minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


def issue_otp_for_email(email: str) -> None:
    user = _find_active_user_by_email(email)
    if not user:
        logger.info("otp_request_unknown email_hash=%s", _email_hash(email))
        return

    now = timezone.now()
    raw_code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        pending_otp = PasswordResetOTP.objects.create(
            user=user,
            code=raw_code,
            expires_at=now + timedelta(minutes=OTP_EXPIRY_MINUTES),
            is_used=True,
            attempt_count=0,
            last_attempt_at=None,
        )

    try:
        _send_otp_email(email=user.email, code=raw_code)
        _mark_pending_otp_delivered(user=user, pending_otp=pending_otp)
        logger.info("otp_request_sent user_id=%s email_hash=%s", user.id, _email_hash(user.email))
    except Exception:
        logger.exception("otp_request_send_failed user_id=%s email_hash=%s", user.id, _email_hash(user.email))


def _validate_otp_attempt(*, user: User, code: str) -> tuple[bool, PasswordResetOTP | None]:
    otp = PasswordResetOTP.objects.filter(user=user, is_used=False).order_by("-created_at").first()
    if not otp:
        return False, None

    if not otp.is_valid():
        return False, None

    if otp.matches_code(code):
        return True, otp

    otp.attempt_count += 1
    otp.last_attempt_at = timezone.now()
    if otp.attempt_count >= OTP_MAX_ATTEMPTS:
        otp.is_used = True
    otp.save(update_fields=["attempt_count", "last_attempt_at", "is_used"])
    return False, otp


def verify_otp(email: str, code: str) -> tuple[bool, datetime | None]:
    user = _find_active_user_by_email(email)
    if not user:
        logger.info("otp_verify_unknown email_hash=%s", _email_hash(email))
        return False, None

    valid, otp = _validate_otp_attempt(user=user, code=code)
    if not valid:
        logger.info("otp_verify_failed user_id=%s email_hash=%s", user.id, _email_hash(user.email))
        return False, None

    logger.info("otp_verify_ok user_id=%s email_hash=%s", user.id, _email_hash(user.email))
    return True, otp.expires_at if otp else None


def reset_password_with_otp(email: str, code: str, new_password: str) -> bool:
    user = _find_active_user_by_email(email)
    if not user:
        logger.info("otp_reset_unknown email_hash=%s", _email_hash(email))
        return False

    valid, otp = _validate_otp_attempt(user=user, code=code)
    if not valid or otp is None:
        logger.info("otp_reset_failed user_id=%s email_hash=%s", user.id, _email_hash(user.email))
        return False

    ensure_valid_password(new_password, user=user, field_name="newPassword")

    with transaction.atomic():
        set_user_password(user=user, new_password=new_password)
        otp.is_used = True
        otp.save(update_fields=["is_used"])

    logger.info("otp_reset_ok user_id=%s email_hash=%s", user.id, _email_hash(user.email))
    return True


def _mark_pending_otp_delivered(*, user: User, pending_otp: PasswordResetOTP) -> None:
    with transaction.atomic():
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
        pending_otp.is_used = False
        pending_otp.save(update_fields=["is_used"])
