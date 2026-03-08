from datetime import timedelta
import hashlib
import hmac

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class UserProfileImage(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        primary_key=True,
        db_column="userId",
        related_name="profile",
    )
    profile_img = models.CharField(max_length=256, blank=True, default="", db_column="profileImg")

    class Meta:
        db_table = "Users"

    def __str__(self) -> str:
        return self.user.username


class PasswordResetOTP(models.Model):
    otp_id = models.AutoField(primary_key=True, db_column="otpId")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="otp_codes")
    code = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True, db_column="createdAt")
    expires_at = models.DateTimeField(db_column="expiresAt")
    is_used = models.BooleanField(default=False, db_column="isUsed")
    attempt_count = models.PositiveSmallIntegerField(default=0, db_column="attemptCount")
    last_attempt_at = models.DateTimeField(null=True, blank=True, db_column="lastAttemptAt")

    class Meta:
        db_table = "PasswordResetOTP"
        indexes = [
            models.Index(fields=["user", "code", "is_used", "expires_at"], name="otp_lookup_idx"),
        ]
        ordering = ["-created_at"]

    @staticmethod
    def hash_code(raw_code: str) -> str:
        return hashlib.sha256(raw_code.encode("utf-8")).hexdigest()

    def set_code(self, raw_code: str) -> None:
        self.code = self.hash_code(raw_code)

    def matches_code(self, raw_code: str) -> bool:
        return hmac.compare_digest(self.code, self.hash_code(raw_code))

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=5)
        if self.code and len(self.code) == 6 and self.code.isdigit():
            self.set_code(self.code)
        super().save(*args, **kwargs)

    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() <= self.expires_at


class RevokedTokenSession(models.Model):
    sid = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="userId",
        related_name="revoked_token_sessions",
        null=True,
        blank=True,
    )
    expires_at = models.DateTimeField(db_column="expiresAt")
    revoked_at = models.DateTimeField(auto_now_add=True, db_column="revokedAt")

    class Meta:
        db_table = "RevokedTokenSession"
        indexes = [
            models.Index(fields=["expires_at"], name="revoked_session_exp_idx"),
        ]

    def is_active(self) -> bool:
        return timezone.now() <= self.expires_at
