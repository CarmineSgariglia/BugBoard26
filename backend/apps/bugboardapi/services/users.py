"""Password reset OTP service logic."""
from __future__ import annotations

import hashlib
import logging
import random
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.core.mail import EmailMessage, send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from ..models import PasswordResetOTP, UserProfileImage
from ..passwords import ensure_valid_password
from ..permissions import is_admin
from ..serializers import UserSerializer
from ..upload_security import store_upload, validate_profile_image

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
PRODUCT_NAME = "BugBoard26"


def _email_hash(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:12]


def _active_user(email: str) -> User | None:
    return User.objects.filter(email__iexact=email.strip(), is_active=True).first()


def _latest_open_otp(user: User) -> PasswordResetOTP | None:
    return (
        PasswordResetOTP.objects.filter(user=user, is_used=False)
        .order_by("-created_at")
        .first()
    )


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
    user = _active_user(email)
    if not user:
        logger.info("otp_request_unknown email_hash=%s", _email_hash(email))
        return

    now = timezone.now()
    with transaction.atomic():
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
        raw_code = f"{random.randint(0, 999999):06d}"
        PasswordResetOTP.objects.create(
            user=user,
            code=raw_code,
            expires_at=now + timedelta(minutes=OTP_EXPIRY_MINUTES),
            attempt_count=0,
            last_attempt_at=None,
        )

    try:
        _send_otp_email(email=user.email, code=raw_code)
        logger.info("otp_request_sent user_id=%s email_hash=%s", user.id, _email_hash(user.email))
    except Exception:
        logger.exception("otp_request_send_failed user_id=%s email_hash=%s", user.id, _email_hash(user.email))


def _validate_and_consume_attempt(*, user: User, code: str) -> tuple[bool, PasswordResetOTP | None]:
    otp = _latest_open_otp(user)
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
    user = _active_user(email)
    if not user:
        logger.info("otp_verify_unknown email_hash=%s", _email_hash(email))
        return False, None

    valid, otp = _validate_and_consume_attempt(user=user, code=code)
    if not valid:
        logger.info("otp_verify_failed user_id=%s email_hash=%s", user.id, _email_hash(user.email))
        return False, None

    logger.info("otp_verify_ok user_id=%s email_hash=%s", user.id, _email_hash(user.email))
    return True, otp.expires_at if otp else None


def reset_password_with_otp(email: str, code: str, new_password: str) -> bool:
    user = _active_user(email)
    if not user:
        logger.info("otp_reset_unknown email_hash=%s", _email_hash(email))
        return False

    valid, otp = _validate_and_consume_attempt(user=user, code=code)
    if not valid or otp is None:
        logger.info("otp_reset_failed user_id=%s email_hash=%s", user.id, _email_hash(user.email))
        return False

    ensure_valid_password(new_password, user=user, field_name="newPassword")

    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=["password"])
        otp.is_used = True
        otp.save(update_fields=["is_used"])

    logger.info("otp_reset_ok user_id=%s email_hash=%s", user.id, _email_hash(user.email))
    return True


def save_profile_image_for_user(*, request, user: User):
    if request.user != user and not is_admin(request.user):
        raise PermissionDenied("Cannot edit other users")

    image = request.FILES.get("image") or request.FILES.get("profile_img")
    if image is None:
        raise ValidationError({"image": "Image file is required"})
    extension, _size = validate_profile_image(image)
    saved = store_upload(
        uploaded_file=image,
        storage_dir=f"profile-images/{user.id}",
        filename_suffix=f".{extension}",
    )
    saved_path = saved.path

    profile, _ = UserProfileImage.objects.get_or_create(user=user)
    old_path = profile.profile_img
    profile.profile_img = saved_path
    profile.save(update_fields=["profile_img"])

    if old_path and old_path != saved_path and old_path.startswith("profile-images/"):
        try:
            default_storage.delete(old_path)
        except Exception:
            logger.warning("Failed to delete old profile image: %s", old_path)

    refreshed_user = User.objects.get(id=user.id)
    return UserSerializer(refreshed_user, context={"request": request}).data
