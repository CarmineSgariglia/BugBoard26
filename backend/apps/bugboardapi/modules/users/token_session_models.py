from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


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
