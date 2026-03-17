from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bugboardapi.modules.users.models import PasswordResetOTP
from apps.bugboardapi.tests.utils import create_user_with_profile


class PasswordChangeSessionContractsTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="password_change_admin",
            email="password_change_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="password_change_member",
            email="password_change_member@example.com",
            password="StrongPass123!",
        )

    def _login(self, *, email: str, password: str) -> tuple[str, str]:
        client = self.client_class()
        response = client.post(
            "/api/auth/login",
            {"email": email, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return (
            response.data["accessToken"],
            response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value,
        )

    def _assert_old_tokens_are_rejected(self, *, access_token: str, refresh_token: str):
        access_client = self.client_class()
        me_response = access_client.get(
            "/api/auth/me",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        self.assertIn(
            me_response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

        refresh_client = self.client_class()
        refresh_client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = refresh_token
        refresh_response = refresh_client.post("/api/auth/refresh", {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(refresh_response.data["detail"], "Invalid refresh token")

    def test_self_change_password_invalidates_existing_access_and_refresh_tokens(self):
        access_token, refresh_token = self._login(
            email=self.member.email,
            password="StrongPass123!",
        )

        response = self.client.post(
            f"/api/users/{self.member.id}/change-password",
            {"currentPassword": "StrongPass123!", "newPassword": "NewStrongPass123!"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self._assert_old_tokens_are_rejected(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    def test_admin_reset_password_invalidates_target_user_existing_tokens(self):
        access_token, refresh_token = self._login(
            email=self.member.email,
            password="StrongPass123!",
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/admin-reset-password",
            {"newPassword": "AdminResetPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self._assert_old_tokens_are_rejected(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    def test_otp_reset_invalidates_existing_access_and_refresh_tokens(self):
        access_token, refresh_token = self._login(
            email=self.member.email,
            password="StrongPass123!",
        )
        raw_code = "123456"
        PasswordResetOTP.objects.create(
            user=self.member,
            code=raw_code,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        response = self.client.post(
            "/api/auth/password/reset",
            {
                "email": self.member.email,
                "code": raw_code,
                "newPassword": "OtpResetPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self._assert_old_tokens_are_rejected(
            access_token=access_token,
            refresh_token=refresh_token,
        )
