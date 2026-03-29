from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.bugboardapi.modules.auth.password_reset import (
    OTP_MAX_ATTEMPTS,
    PasswordResetService,
)
from apps.bugboardapi.modules.users.models import PasswordResetOTP


class PasswordResetOtpUniversityTests(TestCase):
    def setUp(self) -> None:
        self.service = PasswordResetService()
        self.user = User.objects.create_user(
            username="university_otp_user",
            email="university_otp_user@example.com",
        )

    def _create_otp(self, raw_code: str = "123456", **overrides) -> PasswordResetOTP:
        payload = {
            "user": self.user,
            "code": raw_code,
            "expires_at": timezone.now() + timedelta(minutes=5),
            "is_used": False,
            "attempt_count": 0,
            "last_attempt_at": None,
        }
        payload.update(overrides)
        return PasswordResetOTP.objects.create(**payload)

    def test_returns_false_and_none_when_no_open_otp_exists(self):
        valid, otp = self.service._validate_otp_attempt(
            user=self.user,
            code="123456",
        )

        self.assertFalse(valid)
        self.assertIsNone(otp)

    def test_returns_false_and_none_when_latest_otp_is_not_valid(self):
        self._create_otp(
            raw_code="654321",
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        valid, otp = self.service._validate_otp_attempt(
            user=self.user,
            code="654321",
        )

        self.assertFalse(valid)
        self.assertIsNone(otp)

    def test_returns_true_and_matching_otp_when_code_is_correct(self):
        created_otp = self._create_otp(raw_code="111111")

        valid, matched_otp = self.service._validate_otp_attempt(
            user=self.user,
            code="111111",
            lock=True,
        )

        self.assertTrue(valid)
        self.assertIsNotNone(matched_otp)
        self.assertEqual(matched_otp.pk, created_otp.pk)
        created_otp.refresh_from_db()
        self.assertFalse(created_otp.is_used)
        self.assertEqual(created_otp.attempt_count, 0)
        self.assertIsNone(created_otp.last_attempt_at)

    def test_consumes_matching_otp_when_requested_and_consume_succeeds(self):
        created_otp = self._create_otp(raw_code="222222")

        valid, matched_otp = self.service._validate_otp_attempt(
            user=self.user,
            code="222222",
            consume_on_match=True,
        )

        self.assertTrue(valid)
        self.assertIsNotNone(matched_otp)
        self.assertEqual(matched_otp.pk, created_otp.pk)
        created_otp.refresh_from_db()
        self.assertTrue(created_otp.is_used)
        self.assertEqual(created_otp.attempt_count, 0)
        self.assertIsNone(created_otp.last_attempt_at)

    def test_wrong_code_increments_attempt_count_and_updates_last_attempt_at(self):
        created_otp = self._create_otp(raw_code="444444")

        valid, matched_otp = self.service._validate_otp_attempt(
            user=self.user,
            code="999999",
        )

        self.assertFalse(valid)
        self.assertIsNotNone(matched_otp)
        self.assertEqual(matched_otp.pk, created_otp.pk)
        created_otp.refresh_from_db()
        self.assertEqual(created_otp.attempt_count, 1)
        self.assertIsNotNone(created_otp.last_attempt_at)
        self.assertFalse(created_otp.is_used)

    def test_wrong_code_locks_otp_after_reaching_max_attempts(self):
        created_otp = self._create_otp(
            raw_code="555555",
            attempt_count=OTP_MAX_ATTEMPTS - 1,
        )

        valid, matched_otp = self.service._validate_otp_attempt(
            user=self.user,
            code="000000",
        )

        self.assertFalse(valid)
        self.assertIsNotNone(matched_otp)
        self.assertEqual(matched_otp.pk, created_otp.pk)
        created_otp.refresh_from_db()
        self.assertEqual(created_otp.attempt_count, OTP_MAX_ATTEMPTS)
        self.assertTrue(created_otp.is_used)
        self.assertIsNotNone(created_otp.last_attempt_at)
