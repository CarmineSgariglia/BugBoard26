from django.conf import settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.bugboardapi.security.token_sessions import revoke_token_session
from apps.bugboardapi.tests.utils import create_user_with_profile


class RefreshRevocationContractsTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="refresh_revocation_user",
            email="refresh_revocation_user@example.com",
            password="StrongPass123!",
        )

    def test_refresh_rejects_cookie_for_sid_revoked_session(self):
        login_response = self.client.post(
            "/api/auth/login",
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        refresh_cookie = login_response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value
        refresh_token = RefreshToken(refresh_cookie)
        revoke_token_session(
            sid=refresh_token.get("sid"),
            user_id=refresh_token.get("user_id"),
            expires_at_unix=refresh_token.get("exp"),
        )

        response = self.client.post("/api/auth/refresh", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "Invalid refresh token")
