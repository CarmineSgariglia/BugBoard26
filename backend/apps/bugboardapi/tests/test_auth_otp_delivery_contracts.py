from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bugboardapi.modules.users.password_reset_models import PasswordResetOTP
from apps.bugboardapi.tests.utils import create_user_with_profile


class OtpDeliveryContractsTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="otp_delivery_user",
            email="otp_delivery_user@example.com",
            password="StrongPass123!",
        )

    @patch(
        "apps.bugboardapi.modules.auth.password_reset._send_otp_email",
        side_effect=RuntimeError("provider down"),
    )
    def test_failed_otp_delivery_keeps_previous_open_code_usable(self, _mock_send):
        previous_otp = PasswordResetOTP.objects.create(
            user=self.user,
            code="111111",
            expires_at=timezone.now() + timedelta(minutes=5),
            is_used=False,
        )

        with self.assertLogs(
            "apps.bugboardapi.modules.auth.password_reset", level="ERROR"
        ) as logs:
            request_response = self.client.post(
                "/api/password-reset-requests",
                {"email": self.user.email},
                format="json",
            )

        self.assertEqual(request_response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", request_response.data)
        self.assertTrue(
            any("otp_request_send_failed" in message for message in logs.output)
        )

        previous_otp.refresh_from_db()
        self.assertFalse(previous_otp.is_used)

        latest_otp = PasswordResetOTP.objects.filter(user=self.user).order_by("-created_at").first()
        self.assertIsNotNone(latest_otp)
        self.assertTrue(latest_otp.is_used)

        verify_response = self.client.post(
            "/api/password-reset-verifications",
            {"email": self.user.email, "code": "111111"},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_response.data["valid"])
