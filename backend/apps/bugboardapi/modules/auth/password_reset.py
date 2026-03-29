"""Password reset OTP workflow."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from ...common.email_sender import email_sender
from ...security.passwords import ensure_valid_password
from ...security.token_sessions import set_user_password
from ..users.models import PasswordResetOTP

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
PRODUCT_NAME = "BugBoard26"


class PasswordResetService:
    def __init__(
        self,
        *,
        sender=email_sender,
        password_validator=ensure_valid_password,
        password_setter=set_user_password,
    ) -> None:
        self._sender = sender
        self._password_validator = password_validator
        self._password_setter = password_setter

    def issue_otp_for_email(self, email: str) -> None:
        user = self._find_active_user_by_email(email)
        if not user:
            logger.info("otp_request_unknown email_hash=%s", self._email_hash(email))
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
            self.send_otp_email(email=user.email, code=raw_code)
            self._mark_pending_otp_delivered(user=user, pending_otp=pending_otp)
            logger.info("otp_request_sent user_id=%s email_hash=%s", user.id, self._email_hash(user.email))
        except Exception:
            logger.exception("otp_request_send_failed user_id=%s email_hash=%s", user.id, self._email_hash(user.email))

    def verify_otp(self, email: str, code: str) -> tuple[bool, datetime | None]:
        user = self._find_active_user_by_email(email)
        if not user:
            logger.info("otp_verify_unknown email_hash=%s", self._email_hash(email))
            return False, None

        with transaction.atomic():
            valid, otp = self._validate_otp_attempt(
                user=user,
                code=code,
                lock=True,
            )
        if not valid:
            logger.info("otp_verify_failed user_id=%s email_hash=%s", user.id, self._email_hash(user.email))
            return False, None

        logger.info("otp_verify_ok user_id=%s email_hash=%s", user.id, self._email_hash(user.email))
        return True, otp.expires_at if otp else None

    def reset_password_with_otp(self, email: str, code: str, new_password: str) -> bool:
        user = self._find_active_user_by_email(email)
        if not user:
            logger.info("otp_reset_unknown email_hash=%s", self._email_hash(email))
            return False

        with transaction.atomic():
            valid, otp = self._validate_otp_attempt(
                user=user,
                code=code,
                lock=True,
                consume_on_match=True,
            )
            if not valid or otp is None:
                logger.info(
                    "otp_reset_failed user_id=%s email_hash=%s",
                    user.id,
                    self._email_hash(user.email),
                )
                return False

            self._password_validator(new_password, user=user, field_name="newPassword")
            self._password_setter(user=user, new_password=new_password)

        logger.info("otp_reset_ok user_id=%s email_hash=%s", user.id, self._email_hash(user.email))
        return True

    def send_otp_email(self, *, email: str, code: str) -> None:
        self._sender.send(
            email=email,
            plain_subject="BugBoard26 OTP Reset",
            plain_message=f"Your OTP code is {code}. It expires in {OTP_EXPIRY_MINUTES} minutes.",
            brevo_template_id=getattr(settings, "BREVO_OTP_TEMPLATE_ID", ""),
            brevo_merge_data={
                "otp_code": code,
                "expiry_minutes": OTP_EXPIRY_MINUTES,
                "product_name": PRODUCT_NAME,
            },
        )

    def _find_active_user_by_email(self, email: str) -> User | None:
        return User.objects.filter(email__iexact=email.strip(), is_active=True).first()

    def _validate_otp_attempt(
        self,
        *,
        user: User,
        code: str,
        lock: bool = False,
        consume_on_match: bool = False,
    ) -> tuple[bool, PasswordResetOTP | None]:
        otp_queryset = PasswordResetOTP.objects.filter(user=user, is_used=False)
        if lock:
            otp_queryset = otp_queryset.select_for_update()
        otp = otp_queryset.order_by("-created_at").first()
        if not otp:
            return False, None

        if not otp.is_valid():
            return False, None

        if otp.matches_code(code):
            if consume_on_match and not self._consume_pending_otp(otp=otp):
                return False, None
            return True, otp

        otp.attempt_count += 1
        otp.last_attempt_at = timezone.now()
        if otp.attempt_count >= OTP_MAX_ATTEMPTS:
            otp.is_used = True
        otp.save(update_fields=["attempt_count", "last_attempt_at", "is_used"])
        return False, otp

    def _consume_pending_otp(self, *, otp: PasswordResetOTP) -> bool:
        consumed_rows = PasswordResetOTP.objects.filter(pk=otp.pk, is_used=False).update(is_used=True)
        if consumed_rows != 1:
            return False
        otp.is_used = True
        return True

    def _mark_pending_otp_delivered(
        self,
        *,
        user: User,
        pending_otp: PasswordResetOTP,
    ) -> None:
        with transaction.atomic():
            PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
            pending_otp.is_used = False
            pending_otp.save(update_fields=["is_used"])

    @staticmethod
    def _email_hash(email: str) -> str:
        return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:12]


password_reset_service = PasswordResetService()
