from datetime import timedelta

from django.contrib.auth.models import User
from django.core.validators import MinLengthValidator, RegexValidator
from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        primary_key=True,
        db_column="userId",
        related_name="profile",
    )
    is_admin = models.BooleanField(default=False, db_column="isAdmin")
    profile_img = models.CharField(max_length=256, blank=True, default="", db_column="profileImg")
    active = models.BooleanField(default=True, db_column="active")

    class Meta:
        db_table = "Users"

    def __str__(self) -> str:
        return self.user.username


class PasswordResetOTP(models.Model):
    otp_id = models.AutoField(primary_key=True, db_column="otpId")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="otp_codes")
    code = models.CharField(
        max_length=6,
        validators=[MinLengthValidator(6), RegexValidator(r"^\d{6}$", "OTP must be 6 digits")],
    )
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

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=5)
        super().save(*args, **kwargs)

    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() <= self.expires_at
