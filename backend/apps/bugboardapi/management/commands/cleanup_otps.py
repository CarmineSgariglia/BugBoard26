"""Delete OTP records that are no longer usable."""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.bugboardapi.models import PasswordResetOTP


class Command(BaseCommand):
    help = "Delete OTPs that are expired or already used"

    def handle(self, *args, **options):
        now = timezone.now()
        stale_qs = PasswordResetOTP.objects.filter(Q(is_used=True) | Q(expires_at__lt=now))
        deleted, _ = stale_qs.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} stale OTP rows."))
