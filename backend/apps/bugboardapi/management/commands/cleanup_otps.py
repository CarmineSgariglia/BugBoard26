"""Delete OTP records that are no longer usable."""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.bugboardapi.models import PasswordResetOTP, RevokedTokenSession


class Command(BaseCommand):
    help = "Delete OTPs and revoked token sessions that are no longer needed"

    def handle(self, *args, **options):
        now = timezone.now()
        stale_otp_qs = PasswordResetOTP.objects.filter(Q(is_used=True) | Q(expires_at__lt=now))
        deleted_otps, _ = stale_otp_qs.delete()
        stale_sessions_qs = RevokedTokenSession.objects.filter(expires_at__lt=now)
        deleted_sessions, _ = stale_sessions_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted_otps} stale OTP rows and {deleted_sessions} expired revoked sessions."
            )
        )
