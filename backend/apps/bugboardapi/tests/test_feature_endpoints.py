from datetime import timedelta
from io import BytesIO
from pathlib import Path
import subprocess
import re
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.bugboardapi.modules.issues.models import (
    Attachment,
    EventType,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueStatus,
    IssueTag,
)
from apps.bugboardapi.modules.notifications.models import Notification, NotifyType, NotifyUser
from apps.bugboardapi.modules.notifications.services import (
    notify_issue_updated,
    notify_project_added,
)
from apps.bugboardapi.modules.projects.models import ProjectMembership
from apps.bugboardapi.modules.tags.models import Tag
from apps.bugboardapi.modules.users.models import PasswordResetOTP
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


def make_fake_mp4_bytes() -> bytes:
    return b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"


def make_png_bytes(*, size: tuple[int, int], color: str = "blue") -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color=color).save(buffer, format="PNG")
    return buffer.getvalue()


class AuthOtpEndpointTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = create_user_with_profile(
            username="otp_user",
            email="otp_user@example.com",
            password="StrongPass123!",
        )

    def test_otp_request_existing_user_creates_code(self):
        response = self.client.post(
            "/api/auth/password/otp/request", {"email": self.user.email}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PasswordResetOTP.objects.filter(user=self.user).count(), 1)
        otp = PasswordResetOTP.objects.filter(user=self.user).first()
        self.assertIsNotNone(otp)
        self.assertEqual(otp.attempt_count, 0)
        self.assertIsNone(otp.last_attempt_at)

    def test_otp_request_invalidates_previous_unused_otps(self):
        old = PasswordResetOTP.objects.create(
            user=self.user,
            code="111111",
            expires_at=timezone.now() + timedelta(minutes=5),
            is_used=False,
        )
        response = self.client.post(
            "/api/auth/password/otp/request", {"email": self.user.email}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        old.refresh_from_db()
        self.assertTrue(old.is_used)
        self.assertEqual(PasswordResetOTP.objects.filter(user=self.user).count(), 2)

    def test_otp_request_unknown_user_returns_generic_message(self):
        response = self.client.post(
            "/api/auth/password/otp/request",
            {"email": "missing@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PasswordResetOTP.objects.count(), 0)

    def test_otp_verify_and_reset_flow(self):
        raw_code = "123456"
        otp = PasswordResetOTP.objects.create(
            user=self.user,
            code=raw_code,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        verify_response = self.client.post(
            "/api/auth/password/otp/verify",
            {"email": self.user.email, "code": raw_code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_response.data["valid"])

        reset_response = self.client.post(
            "/api/auth/password/reset",
            {
                "email": self.user.email,
                "code": raw_code,
                "newPassword": "NewStrongPass123!",
            },
            format="json",
        )
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)
        otp.refresh_from_db()
        self.assertTrue(otp.is_used)
        self.assertNotEqual(otp.code, raw_code)
        self.assertTrue(
            authenticate(username=self.user.username, password="NewStrongPass123!")
        )

    def test_otp_verify_rejects_expired_code(self):
        PasswordResetOTP.objects.create(
            user=self.user,
            code="654321",
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        response = self.client.post(
            "/api/auth/password/otp/verify",
            {"email": self.user.email, "code": "654321"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["valid"])

    def test_otp_verify_wrong_code_increments_attempt_count(self):
        otp = PasswordResetOTP.objects.create(
            user=self.user,
            code="222222",
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        response = self.client.post(
            "/api/auth/password/otp/verify",
            {"email": self.user.email, "code": "999999"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["valid"])
        otp.refresh_from_db()
        self.assertEqual(otp.attempt_count, 1)
        self.assertIsNotNone(otp.last_attempt_at)
        self.assertFalse(otp.is_used)

    def test_otp_verify_locks_after_5_attempts(self):
        otp = PasswordResetOTP.objects.create(
            user=self.user,
            code="333333",
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        for _ in range(5):
            response = self.client.post(
                "/api/auth/password/otp/verify",
                {"email": self.user.email, "code": "000000"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertFalse(response.data["valid"])
        otp.refresh_from_db()
        self.assertEqual(otp.attempt_count, 5)
        self.assertTrue(otp.is_used)

    def test_password_reset_rejects_expired_or_locked_otp(self):
        expired_code = "555555"
        expired = PasswordResetOTP.objects.create(
            user=self.user,
            code=expired_code,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        expired_response = self.client.post(
            "/api/auth/password/reset",
            {
                "email": self.user.email,
                "code": expired_code,
                "newPassword": "NewStrongPass123!",
            },
            format="json",
        )
        self.assertEqual(expired_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", expired_response.data)

        locked_code = "666666"
        locked = PasswordResetOTP.objects.create(
            user=self.user,
            code=locked_code,
            expires_at=timezone.now() + timedelta(minutes=5),
            is_used=True,
        )
        locked_response = self.client.post(
            "/api/auth/password/reset",
            {
                "email": self.user.email,
                "code": locked_code,
                "newPassword": "NewStrongPass123!",
            },
            format="json",
        )
        self.assertEqual(locked_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", locked_response.data)

    @patch(
        "apps.bugboardapi.modules.auth.password_reset._send_otp_email",
        side_effect=RuntimeError("provider down"),
    )
    def test_otp_request_email_send_failure_returns_generic_and_logs_error(
        self, _mock_send
    ):
        with self.assertLogs(
            "apps.bugboardapi.modules.auth.password_reset", level="ERROR"
        ) as logs:
            response = self.client.post(
                "/api/auth/password/otp/request",
                {"email": self.user.email},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        self.assertTrue(
            any("otp_request_send_failed" in message for message in logs.output)
        )

    @override_settings(EMAIL_PROVIDER="console")
    @patch("apps.bugboardapi.modules.auth.password_reset.send_mail")
    def test_email_provider_console_default_in_dev(self, mock_send_mail):
        response = self.client.post(
            "/api/auth/password/otp/request", {"email": self.user.email}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_send_mail.called)

    @override_settings(EMAIL_PROVIDER="console")
    @patch("apps.bugboardapi.modules.auth.password_reset.send_mail")
    def test_otp_request_email_contains_raw_six_digit_code_not_hash(self, mock_send_mail):
        response = self.client.post(
            "/api/auth/password/otp/request", {"email": self.user.email}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        message = mock_send_mail.call_args.kwargs["message"]
        self.assertRegex(message, r"\b\d{6}\b")
        self.assertIsNone(re.search(r"\b[a-f0-9]{64}\b", message))

    def test_password_reset_rejects_weak_password(self):
        raw_code = "654123"
        otp = PasswordResetOTP.objects.create(
            user=self.user,
            code=raw_code,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        response = self.client.post(
            "/api/auth/password/reset",
            {
                "email": self.user.email,
                "code": raw_code,
                "newPassword": "12345678",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("newPassword", response.data)
        otp.refresh_from_db()
        self.assertFalse(otp.is_used)

    @override_settings(
        EMAIL_PROVIDER="brevo",
        BREVO_OTP_TEMPLATE_ID="123",
        DEFAULT_FROM_EMAIL="noreply@example.com",
        BREVO_SENDER_NAME="BugBoard26",
    )
    @patch("apps.bugboardapi.modules.auth.password_reset.EmailMessage.send", return_value=1)
    @patch("apps.bugboardapi.modules.auth.password_reset.send_mail")
    def test_email_provider_brevo_uses_anymail_backend(
        self, mock_send_mail, _mock_email_send
    ):
        response = self.client.post(
            "/api/auth/password/otp/request", {"email": self.user.email}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(mock_send_mail.called)


class UserManagementEndpointTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="users_admin",
            email="users_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.other_admin = create_user_with_profile(
            username="users_admin_other",
            email="users_admin_other@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="users_member",
            email="users_member@example.com",
            password="StrongPass123!",
        )

    def test_non_admin_user_list_returns_only_self(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/users")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["userId"], self.member.id)

    def test_admin_user_list_returns_multiple_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)
        self.assertGreaterEqual(response.data["count"], 2)
        self.assertGreaterEqual(len(response.data["results"]), 2)

    def test_admin_user_list_search_filter(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users?search=users_member")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["userId"], self.member.id)

    def test_admin_user_list_role_filter_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users?role=Admin")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 2)
        self.assertTrue(all(user["isAdmin"] for user in response.data["results"]))

    def test_admin_user_list_role_filter_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users?role=User")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)
        self.assertTrue(all(not user["isAdmin"] for user in response.data["results"]))

    def test_admin_user_list_status_filter_active_and_inactive(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        active_response = self.client.get("/api/users?status=Active")
        inactive_response = self.client.get("/api/users?status=Inactive")

        self.assertEqual(active_response.status_code, status.HTTP_200_OK)
        self.assertEqual(inactive_response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(user["active"] for user in active_response.data["results"]))
        self.assertTrue(
            all(not user["active"] for user in inactive_response.data["results"])
        )

    def test_admin_user_list_combined_filters(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            "/api/users?search=users_admin_other&role=Admin&status=Active"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["userId"], self.other_admin.id)

    def test_admin_user_list_pagination_second_page(self):
        for idx in range(12):
            create_user_with_profile(
                username=f"users_extra_{idx}",
                email=f"users_extra_{idx}@example.com",
                password="StrongPass123!",
            )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users?page=2")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["previous"])
        self.assertGreater(response.data["count"], 10)
        self.assertGreaterEqual(len(response.data["results"]), 1)

    def test_user_create_requires_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/users",
            {
                "username": "new_user",
                "email": "new_user@example.com",
                "password": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_create_rejects_weak_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/users",
            {
                "username": "weak_user",
                "email": "weak_user@example.com",
                "password": "12345678",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_admin_user_create_rejects_duplicate_email(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/users",
            {
                "username": "duplicate_email_user",
                "email": self.member.email,
                "password": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"][0], "Email already in use")

    def test_admin_user_create_rejects_duplicate_email_with_different_casing(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/users",
            {
                "username": "duplicate_email_case_user",
                "email": self.member.email.upper(),
                "password": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"][0], "Email already in use")

    def test_admin_user_create_rejects_duplicate_username(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/users",
            {
                "username": self.member.username,
                "email": "duplicate-username@example.com",
                "password": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["username"][0], "A user with that username already exists.")

    def test_user_delete_endpoint_is_disabled(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/users/{self.member.id}")
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(User.objects.filter(id=self.member.id).exists())

    def test_admin_can_toggle_user_status_with_status_endpoint(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        activate = self.client.post(
            f"/api/users/{self.member.id}/status",
            {"active": True},
            format="json",
        )
        self.assertEqual(activate.status_code, status.HTTP_200_OK)
        self.assertTrue(activate.data["active"])

        deactivate = self.client.post(
            f"/api/users/{self.member.id}/status",
            {"active": False},
            format="json",
        )
        self.assertEqual(deactivate.status_code, status.HTTP_200_OK)
        self.assertFalse(deactivate.data["active"])

    def test_profile_image_upload_self_success(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile(
            "avatar.png", make_png_bytes(size=(1800, 1800)), content_type="image/png"
        )
        response = self.client.post(
            "/api/users/me/upload_profile_image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(
            self.member.profile.profile_img.startswith(
                f"profile-images/{self.member.id}/"
            )
        )
        self.assertTrue(response.data["profileImg"].endswith(".webp"))

    def test_profile_image_upload_rejects_invalid_type(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile(
            "avatar.txt", b"not-image", content_type="text/plain"
        )
        response = self.client.post(
            "/api/users/me/upload_profile_image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_profile_image_upload_rejects_too_large(self):
        self.client.force_authenticate(user=self.member)
        big_bytes = b"a" * (2 * 1024 * 1024 + 1)
        image = SimpleUploadedFile("big.png", big_bytes, content_type="image/png")
        response = self.client.post(
            "/api/users/me/upload_profile_image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_profile_image_upload_me_endpoint_with_profile_img_field(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile(
            "avatar.png", make_png_bytes(size=(1600, 1200)), content_type="image/png"
        )
        response = self.client.post(
            "/api/users/me/upload_profile_image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(
            self.member.profile.profile_img.startswith(
                f"profile-images/{self.member.id}/"
            )
        )

    def test_profile_image_upload_me_endpoint_kebab_case_alias(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile(
            "avatar.png", make_png_bytes(size=(1200, 1600)), content_type="image/png"
        )
        response = self.client.post(
            "/api/users/me/upload-profile-image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(
            self.member.profile.profile_img.startswith(
                f"profile-images/{self.member.id}/"
            )
        )

    def test_admin_upload_profile_image_for_other_user_via_admin_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        image = SimpleUploadedFile(
            "avatar.png", make_png_bytes(size=(1400, 1400)), content_type="image/png"
        )
        response = self.client.post(
            f"/api/users/{self.member.id}/admin-upload-image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(
            self.member.profile.profile_img.startswith(
                f"profile-images/{self.member.id}/"
            )
        )

    def test_non_admin_cannot_use_admin_upload_profile_image_endpoint(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile(
            "avatar.png", make_png_bytes(size=(1000, 1000)), content_type="image/png"
        )
        response = self.client.post(
            f"/api/users/{self.admin.id}/admin-upload-image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_profile_image_upload_uses_compressed_storage_artifact(self):
        self.client.force_authenticate(user=self.member)
        raw_bytes = make_png_bytes(size=(2600, 2100))
        image = SimpleUploadedFile("avatar.png", raw_bytes, content_type="image/png")

        with patch(
            "apps.bugboardapi.security.uploads.default_storage.save",
            return_value=f"profile-images/{self.member.id}/compressed.webp",
        ) as save_mock:
            response = self.client.post(
                "/api/users/me/upload_profile_image",
                {"profile_img": image},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        stored_file = save_mock.call_args.args[1]
        self.assertEqual(getattr(stored_file, "content_type", ""), "image/webp")
        self.assertLess(getattr(stored_file, "size", 0), len(raw_bytes))
        self.assertEqual(self.member.profile.profile_img, f"profile-images/{self.member.id}/compressed.webp")

    def test_profile_image_upload_returns_503_when_storage_backend_fails(self):
        self.client.force_authenticate(user=self.member)
        self.client.raise_request_exception = False
        image = SimpleUploadedFile(
            "avatar.png", make_png_bytes(size=(1600, 1200)), content_type="image/png"
        )

        with patch(
            "apps.bugboardapi.security.uploads.default_storage.save",
            side_effect=RuntimeError("gcs unavailable"),
        ):
            response = self.client.post(
                "/api/users/me/upload_profile_image",
                {"profile_img": image},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "Media storage is temporarily unavailable. Retry later.")
        self.member.refresh_from_db()
        self.assertEqual(self.member.profile.profile_img, "")

    def test_change_password_success(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password",
            {"currentPassword": "StrongPass123!", "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("NewStrongPass123!"))

    def test_change_password_rejects_wrong_current(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password",
            {"currentPassword": "wrong-pass", "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currentPassword", response.data)

    def test_change_password_rejects_weak_password(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password",
            {"currentPassword": "StrongPass123!", "newPassword": "12345678"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("newPassword", response.data)

    def test_generic_user_patch_password_is_rejected(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/users/{self.member.id}",
            {"password": "AnotherStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_admin_can_reset_password_for_other_user_without_current(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password",
            {"newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("NewStrongPass123!"))

    def test_admin_can_reset_password_for_other_user_via_admin_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/admin-reset-password",
            {"newPassword": "AdminEndpointPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("AdminEndpointPass123!"))

    def test_non_admin_cannot_use_admin_reset_password_endpoint(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.admin.id}/admin-reset-password",
            {"newPassword": "AdminEndpointPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_reset_password_for_other_admin_without_current(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.other_admin.id}/change-password",
            {"newPassword": "AnotherStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_admin.refresh_from_db()
        self.assertTrue(self.other_admin.check_password("AnotherStrongPass123!"))

    def test_non_admin_cannot_change_other_user_password(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.admin.id}/change-password",
            {"newPassword": "AnotherStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_self_change_requires_current_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.admin.id}/change-password",
            {"newPassword": "AnotherStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currentPassword", response.data)

    def test_admin_reset_rejects_same_password_as_current_target_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password",
            {"newPassword": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("newPassword", response.data)


class ProjectAndMembershipEndpointTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="projects_admin",
            email="projects_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="projects_member",
            email="projects_member@example.com",
            password="StrongPass123!",
        )
        self.outsider = create_user_with_profile(
            username="projects_outsider",
            email="projects_outsider@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Proj Membership",
            admin_members=[self.admin],
            developer_members=[self.member],
        )

    def test_projects_list_scoped_by_membership(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get("/api/projects")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_project_retrieve_returns_single_project(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/projects/{self.project.project_id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["projectId"], self.project.project_id)
        self.assertEqual(response.data["name"], self.project.name)

    def test_project_create_adds_admin_as_member(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/projects",
            {
                "name": "New Admin Project",
                "description": "D",
                "color": "#111111",
                "icon": "star",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["icon"], "star")
        project_id = response.data["projectId"]
        membership = ProjectMembership.objects.filter(
            project_id=project_id, user=self.admin
        ).first()
        self.assertIsNone(membership)
        self.assertEqual(response.data["createdBy"], self.admin.id)

    def test_project_membership_is_exposed_through_many_to_many_relation(self):
        self.assertIn(self.member, self.project.members.all())
        self.assertIn(self.project, self.member.projects.all())

    def test_project_create_accepts_team_alias_and_emits_added_notification(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/projects",
            {
                "name": "Team Alias Project",
                "description": "D",
                "color": "#222222",
                "icon": "folder",
                "team": [self.member.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project_id = response.data["projectId"]
        self.assertTrue(
            ProjectMembership.objects.filter(
                project_id=project_id, user=self.member
            ).exists()
        )
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.PROJECT_ADDED,
                notification__project_id=project_id,
            ).exists()
        )

    def test_project_create_accepts_empty_team_array(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/projects",
            {
                "name": "Empty Team Project",
                "description": "D",
                "color": "#333333",
                "icon": "folder",
                "team": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project_id = response.data["projectId"]

        self.assertFalse(
            ProjectMembership.objects.filter(
                project_id=project_id,
                user=self.admin,
            ).exists()
        )
        self.assertFalse(
            ProjectMembership.objects.filter(
                project_id=project_id,
                user=self.member,
            ).exists()
        )
    def test_members_endpoint_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/projects/{self.project.project_id}/members")
        self.assertIn(
            response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        )

    def test_members_endpoint_excludes_admins_by_default(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/projects/{self.project.project_id}/members")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_user_ids = {item["userId"] for item in response.data}
        self.assertIn(self.member.id, returned_user_ids)
        self.assertNotIn(self.admin.id, returned_user_ids)

    def test_members_endpoint_can_include_admins_with_flag(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/projects/{self.project.project_id}/members?includeAdmins=true"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_user_ids = {item["userId"] for item in response.data}
        self.assertIn(self.member.id, returned_user_ids)
        self.assertIn(self.admin.id, returned_user_ids)

    def test_project_subscription_get_returns_current_admin_state(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/projects/{self.project.project_id}/subscription")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"subscribed": True})

    def test_project_subscription_get_returns_false_for_unsubscribed_admin(self):
        other_admin = create_user_with_profile(
            username="projects_subscription_admin",
            email="projects_subscription_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.client.force_authenticate(user=other_admin)
        response = self.client.get(f"/api/projects/{self.project.project_id}/subscription")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"subscribed": False})

    def test_project_subscription_post_is_idempotent(self):
        other_admin = create_user_with_profile(
            username="projects_subscribe_post_admin",
            email="projects_subscribe_post_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.client.force_authenticate(user=other_admin)

        first_response = self.client.post(
            f"/api/projects/{self.project.project_id}/subscription",
            format="json",
        )
        second_response = self.client.post(
            f"/api/projects/{self.project.project_id}/subscription",
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(second_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(
            ProjectMembership.objects.filter(project=self.project, user=other_admin).count(),
            1,
        )

    def test_project_subscription_delete_is_idempotent(self):
        self.client.force_authenticate(user=self.admin)

        first_response = self.client.delete(
            f"/api/projects/{self.project.project_id}/subscription",
            format="json",
        )
        second_response = self.client.delete(
            f"/api/projects/{self.project.project_id}/subscription",
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(second_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            ProjectMembership.objects.filter(project=self.project, user=self.admin).exists()
        )

    def test_project_subscription_forbidden_for_developer(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/subscription",
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_members_endpoint_keeps_inactive_members_visible_in_current_contract(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/projects/{self.project.project_id}/members")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_user_ids = {item["userId"] for item in response.data}
        self.assertIn(self.member.id, returned_user_ids)

    def test_project_patch_team_sync_adds_and_removes_developers(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/projects/{self.project.project_id}",
            {"team": [self.outsider.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.outsider,
            ).exists()
        )
        self.assertFalse(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.member,
            ).exists()
        )
        self.assertTrue(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.admin,
            ).exists()
        )
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.PROJECT_UNASSIGNED,
                notification__project=self.project,
            ).exists()
        )

    def test_project_patch_team_does_not_notify_inactive_removed_members(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/projects/{self.project.project_id}",
            {"team": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.PROJECT_UNASSIGNED,
                notification__project=self.project,
            ).exists()
        )

    def test_project_patch_team_accepts_empty_list_and_removes_all_developers(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/projects/{self.project.project_id}",
            {"team": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertFalse(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.member,
            ).exists()
        )
        self.assertTrue(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.admin,
            ).exists()
        )
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.PROJECT_UNASSIGNED,
                notification__project=self.project,
            ).exists()
        )

    def test_project_patch_team_ignores_admin_ids_in_team_payload(self):
        other_admin = create_user_with_profile(
            username="projects_admin_two",
            email="projects_admin_two@example.com",
            password="StrongPass123!",
            is_admin=True,
        )

        self.client.force_authenticate(user=other_admin)
        response = self.client.patch(
            f"/api/projects/{self.project.project_id}",
            {"team": [self.member.id, other_admin.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            ProjectMembership.objects.filter(
                project=self.project,
                user=other_admin,
            ).exists()
        )
        self.assertFalse(
            NotifyUser.objects.filter(
                user=other_admin,
                notification__notify_type=NotifyType.PROJECT_ADDED,
                notification__project=self.project,
            ).exists()
        )

    def test_project_delete_allows_plain_delete_for_current_frontend_flow(self):
        issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Issue for cascade delete",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="MEDIUM",
        )
        self.client.force_authenticate(user=self.admin)
        no_confirm = self.client.delete(
            f"/api/projects/{self.project.project_id}", format="json"
        )
        self.assertEqual(no_confirm.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Issue.objects.filter(issue_id=issue.issue_id).exists())


class IssueWorkflowEndpointTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="issues_admin",
            email="issues_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="issues_member",
            email="issues_member@example.com",
            password="StrongPass123!",
        )
        self.outsider = create_user_with_profile(
            username="issues_outsider",
            email="issues_outsider@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Issues Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.tag = Tag.objects.create(name="api")
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Initial issue",
            description="Issue desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="HIGH",
        )
        IssueAssignee.objects.create(issue=self.issue, user=self.member)

    def test_project_issues_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/projects/{self.project.project_id}/issues")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_project_issue_create_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues",
            {
                "title": "Outsider issue",
                "description": "Should stay hidden",
                "type": "BUG",
                "status": "TODO",
                "priority": "HIGH",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_project_issues_support_combined_q_type_priority_and_tag_filters(self):
        frontend_tag = Tag.objects.create(name="frontend")
        matching_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="API filtered feature",
            description="desc",
            issue_type="FEATURE",
            status=IssueStatus.TODO,
            priority="HIGH",
        )
        IssueTag.objects.create(issue=matching_issue, tag=self.tag)

        wrong_priority_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="API filtered feature low",
            description="desc",
            issue_type="FEATURE",
            status=IssueStatus.TODO,
            priority="LOW",
        )
        IssueTag.objects.create(issue=wrong_priority_issue, tag=self.tag)

        wrong_tag_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="API filtered feature wrong tag",
            description="desc",
            issue_type="FEATURE",
            status=IssueStatus.TODO,
            priority="HIGH",
        )
        IssueTag.objects.create(issue=wrong_tag_issue, tag=frontend_tag)

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/projects/{self.project.project_id}/issues"
            "?q=API filtered&category=FEATURE&priority=HIGH&tag=api"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["issueId"] for item in response.data], [matching_issue.issue_id])

    def test_project_issues_support_date_range_filters(self):
        old_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Old issue",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="MEDIUM",
        )
        recent_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Recent issue",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="MEDIUM",
        )
        today = timezone.now()
        old_date = today - timedelta(days=7)
        recent_date = today - timedelta(days=1)
        Issue.objects.filter(issue_id=old_issue.issue_id).update(created_at=old_date)
        Issue.objects.filter(issue_id=recent_issue.issue_id).update(created_at=recent_date)

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/projects/{self.project.project_id}/issues"
            f"?date_from={recent_date.date().isoformat()}&date_to={today.date().isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["issueId"] for item in response.data}
        self.assertIn(recent_issue.issue_id, returned_ids)
        self.assertNotIn(old_issue.issue_id, returned_ids)

    def test_issue_create_creates_event(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Created issue",
            "description": "Created from test",
            "type": "BUG",
            "status": "TODO",
            "priority": "MEDIUM",
            "assigneeIds": [self.member.id],
            "tagIds": [self.tag.tag_id],
        }
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_issue = Issue.objects.get(issue_id=response.data["issueId"])
        self.assertTrue(
            IssueEvent.objects.filter(
                issue=new_issue, event_type=EventType.CREATE
            ).exists()
        )
        self.assertFalse(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_ADDED,
                notification__issue=new_issue,
                notification__project=self.project,
            ).exists()
        )

    def test_issue_create_does_not_notify_creator_when_they_are_the_only_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues",
            {
                "title": "Self notification check",
                "description": "Created from test",
                "type": "BUG",
                "status": "TODO",
                "priority": "LOW",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_issue = Issue.objects.get(issue_id=response.data["issueId"])
        self.assertFalse(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_ADDED,
                notification__issue=new_issue,
            ).exists()
        )

    def test_issue_create_notifies_only_subscribed_admins(self):
        subscribed_admin = create_user_with_profile(
            username="issues_subscribed_admin",
            email="issues_subscribed_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        unsubscribed_admin = create_user_with_profile(
            username="issues_unsubscribed_admin",
            email="issues_unsubscribed_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        ProjectMembership.objects.create(project=self.project, user=subscribed_admin)

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues",
            {
                "title": "Subscription issue create",
                "description": "Created from test",
                "type": "BUG",
                "status": "TODO",
                "priority": "LOW",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_issue = Issue.objects.get(issue_id=response.data["issueId"])
        self.assertTrue(
            NotifyUser.objects.filter(
                user=subscribed_admin,
                notification__notify_type=NotifyType.ISSUE_ADDED,
                notification__issue=new_issue,
            ).exists()
        )
        self.assertFalse(
            NotifyUser.objects.filter(
                user=unsubscribed_admin,
                notification__notify_type=NotifyType.ISSUE_ADDED,
                notification__issue=new_issue,
            ).exists()
        )

    def test_issue_create_auto_assigns_reporter(self):
        self.client.force_authenticate(user=self.member)
        payload = {
            "title": "Reporter assigned issue",
            "description": "Created from test",
            "type": "BUG",
            "status": "TODO",
            "priority": "MEDIUM",
        }
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_issue = Issue.objects.get(issue_id=response.data["issueId"])
        self.assertTrue(
            IssueAssignee.objects.filter(issue=new_issue, user=self.member).exists()
        )

    def test_issue_create_with_assignee_ids_keeps_requested_assignees_and_skips_admin_reporter_subscription(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Created issue with assignees",
            "description": "Created from test",
            "type": "BUG",
            "status": "TODO",
            "priority": "MEDIUM",
            "assigneeIds": [self.member.id],
        }
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_issue = Issue.objects.get(issue_id=response.data["issueId"])
        assignee_ids = set(
            IssueAssignee.objects.filter(issue=new_issue).values_list("user_id", flat=True)
        )
        self.assertEqual(assignee_ids, {self.member.id})

    def test_issue_subscription_get_returns_false_for_unsubscribed_admin(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(f"/api/issues/{self.issue.issue_id}/subscription")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"subscribed": False})

    def test_issue_subscription_post_is_idempotent(self):
        self.client.force_authenticate(user=self.admin)

        first_response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/subscription",
            format="json",
        )
        second_response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/subscription",
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(second_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(
            IssueAssignee.objects.filter(issue=self.issue, user=self.admin).count(),
            1,
        )

    def test_issue_subscription_delete_is_idempotent(self):
        IssueAssignee.objects.create(issue=self.issue, user=self.admin)
        self.client.force_authenticate(user=self.admin)

        first_response = self.client.delete(
            f"/api/issues/{self.issue.issue_id}/subscription",
            format="json",
        )
        second_response = self.client.delete(
            f"/api/issues/{self.issue.issue_id}/subscription",
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(second_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            IssueAssignee.objects.filter(issue=self.issue, user=self.admin).exists()
        )

    def test_issue_subscription_forbidden_for_developer(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/subscription",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_issue_create_rejects_admin_assignee(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Created issue",
            "description": "Created from test",
            "type": "BUG",
            "status": "TODO",
            "priority": "MEDIUM",
            "assigneeIds": [self.admin.id],
        }
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["assigneeIds"][0]),
            f"Admin users cannot be assigned to issues: [{self.admin.id}]",
        )

    def test_issue_create_rejects_inactive_assignee(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Created issue",
            "description": "Created from test",
            "type": "BUG",
            "status": "TODO",
            "priority": "MEDIUM",
            "assigneeIds": [self.member.id],
        }
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["assigneeIds"][0]),
            f"Users must be members of project: [{self.member.id}]",
        )

    def test_issue_create_with_tag_names_reuses_existing_and_creates_missing(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Created issue with names",
            "description": "Created from test",
            "type": "BUG",
            "status": "TODO",
            "priority": "MEDIUM",
            "tagNames": ["api", "frontend", "API"],
        }
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/issues", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_issue = Issue.objects.get(issue_id=response.data["issueId"])
        issue_tag_names = set(created_issue.tags.values_list("name", flat=True))
        self.assertEqual(issue_tag_names, {"Api", "Frontend"})
        self.assertEqual(Tag.objects.filter(name__iexact="api").count(), 1)
        self.assertEqual(Tag.objects.filter(name__iexact="frontend").count(), 1)

    def test_issue_update_with_tag_names_reuses_existing_tags(self):
        self.client.force_authenticate(user=self.member)
        Tag.objects.create(name="ops")

        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"tagNames": ["api", "ops", "API"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.issue.refresh_from_db()
        issue_tag_names = set(self.issue.tags.values_list("name", flat=True))
        self.assertEqual(issue_tag_names, {"Api", "Ops"})
        self.assertEqual(Tag.objects.filter(name__iexact="api").count(), 1)

    def test_issue_update_with_tag_names_creates_missing_tags_for_non_admin(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"tagNames": ["api", "new-tag"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Tag.objects.filter(name__iexact="new-tag").exists())

    def test_issue_update_rejects_assignee_outside_project(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"assigneeIds": [self.outsider.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigneeIds", response.data)
        self.assertFalse(
            IssueAssignee.objects.filter(issue=self.issue, user=self.outsider).exists()
        )

    def test_issue_update_rejects_admin_assignee(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"assigneeIds": [self.admin.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["assigneeIds"][0]),
            f"Admin users cannot be assigned to issues: [{self.admin.id}]",
        )

    def test_issue_update_rejects_inactive_assignee(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"assigneeIds": [self.member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["assigneeIds"][0]),
            f"Users must be members of project: [{self.member.id}]",
        )

    def test_issue_update_replaces_assignee_set(self):
        another_member = create_user_with_profile(
            username="issues_member_replace",
            email="issues_member_replace@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=another_member)

        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"assigneeIds": [another_member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        assignee_ids = set(
            IssueAssignee.objects.filter(issue=self.issue).values_list("user_id", flat=True)
        )
        self.assertEqual(assignee_ids, {another_member.id})

    def test_outsider_cannot_create_tag_indirectly_via_issue_update(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"tagNames": ["forbidden-tag"]},
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )
        self.assertFalse(Tag.objects.filter(name__iexact="forbidden-tag").exists())

    def test_assign_requires_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [self.member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assign_rejects_non_member_assignee(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [self.outsider.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userIds", response.data)

    def test_assign_rejects_admin_assignee(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [self.admin.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["userIds"],
            f"Admin users cannot be assigned to issues: [{self.admin.id}]",
        )

    def test_assign_rejects_inactive_assignee(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [self.member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["userIds"],
            f"Users must be members of project: [{self.member.id}]",
        )

    def test_assign_notifies_subscribed_admin_observer(self):
        observer_admin = create_user_with_profile(
            username="issues_assign_observer_admin",
            email="issues_assign_observer_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        another_member = create_user_with_profile(
            username="issues_assign_target_member",
            email="issues_assign_target_member@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=observer_admin)
        ProjectMembership.objects.create(project=self.project, user=another_member)
        IssueAssignee.objects.create(issue=self.issue, user=observer_admin)

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [another_member.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=observer_admin,
                notification__notify_type=NotifyType.ISSUE_ASSIGNED,
                notification__issue=self.issue,
            ).exists()
        )

    def test_assign_does_not_notify_issue_observer_when_project_notifications_disabled(self):
        observer_admin = create_user_with_profile(
            username="issues_assign_blocked_admin",
            email="issues_assign_blocked_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        another_member = create_user_with_profile(
            username="issues_assign_blocked_target",
            email="issues_assign_blocked_target@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=another_member)
        IssueAssignee.objects.create(issue=self.issue, user=observer_admin)

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [another_member.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            NotifyUser.objects.filter(
                user=observer_admin,
                notification__notify_type=NotifyType.ISSUE_ASSIGNED,
                notification__issue=self.issue,
            ).exists()
        )

    def test_suggestions_exclude_admins(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/suggestions")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        suggested_user_ids = {item["userId"] for item in response.data}
        self.assertIn(self.member.id, suggested_user_ids)
        self.assertNotIn(self.admin.id, suggested_user_ids)

    def test_suggestions_match_members_payload_plus_open_count(self):
        self.client.force_authenticate(user=self.member)
        members_response = self.client.get(f"/api/projects/{self.project.project_id}/members")
        suggestions_response = self.client.get(f"/api/issues/{self.issue.issue_id}/suggestions")

        self.assertEqual(members_response.status_code, status.HTTP_200_OK)
        self.assertEqual(suggestions_response.status_code, status.HTTP_200_OK)

        member_by_user_id = {item["userId"]: item for item in members_response.data}
        suggestion_by_user_id = {item["userId"]: item for item in suggestions_response.data}
        self.assertIn(self.member.id, suggestion_by_user_id)

        suggestion_item = suggestion_by_user_id[self.member.id]
        members_item = member_by_user_id[self.member.id]

        for key, value in members_item.items():
            self.assertIn(key, suggestion_item)
            self.assertEqual(suggestion_item[key], value)
        self.assertIn("openCount", suggestion_item)
        self.assertEqual(suggestion_item["openCount"], 1)

    def test_suggestions_open_count_is_global_across_projects(self):
        other_project = create_project_with_members(
            created_by=self.admin,
            name="Suggestions Global Count",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        other_issue = Issue.objects.create(
            project=other_project,
            reporter=self.admin,
            title="Other project issue",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="MEDIUM",
        )
        IssueAssignee.objects.create(issue=other_issue, user=self.member)

        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/suggestions")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        suggestion_by_user_id = {item["userId"]: item for item in response.data}
        self.assertEqual(suggestion_by_user_id[self.member.id]["openCount"], 2)

    def test_suggestions_exclude_inactive_members(self):
        inactive_member = create_user_with_profile(
            username="issues_inactive_member",
            email="issues_inactive_member@example.com",
            password="StrongPass123!",
        )
        inactive_member.is_active = False
        inactive_member.save(update_fields=["is_active"])
        ProjectMembership.objects.create(project=self.project, user=inactive_member)

        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/suggestions")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        suggested_user_ids = {item["userId"] for item in response.data}
        self.assertNotIn(inactive_member.id, suggested_user_ids)

    def test_suggestions_ordered_by_open_count_then_username(self):
        alpha_member = create_user_with_profile(
            username="aaa_member",
            email="aaa_member@example.com",
            password="StrongPass123!",
        )
        beta_member = create_user_with_profile(
            username="bbb_member",
            email="bbb_member@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=alpha_member)
        ProjectMembership.objects.create(project=self.project, user=beta_member)

        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/suggestions")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        usernames = [item["username"] for item in response.data]
        open_counts = [item["openCount"] for item in response.data]
        self.assertEqual(open_counts, sorted(open_counts))
        self.assertLess(usernames.index("aaa_member"), usernames.index("bbb_member"))

    def test_issue_payload_excludes_admin_assignees(self):
        IssueAssignee.objects.get_or_create(issue=self.issue, user=self.admin)
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/projects/{self.project.project_id}/issues")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        issue_payload = next(
            item for item in response.data if item["issueId"] == self.issue.issue_id
        )
        assignee_ids = {item["userId"] for item in issue_payload["assignees"]}
        self.assertIn(self.member.id, assignee_ids)
        self.assertNotIn(self.admin.id, assignee_ids)

    def test_assignee_can_change_status_to_done(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status",
            {"status": "DONE", "message": "done now"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.status, IssueStatus.DONE)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_CLOSED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_status_update_does_not_notify_actor_when_actor_is_reporter(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status",
            {"status": "DONE", "message": "done by reporter"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_CLOSED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_status_update_notifies_subscribed_admins_and_skips_unsubscribed_admins(self):
        subscribed_admin = create_user_with_profile(
            username="issues_close_subscribed_admin",
            email="issues_close_subscribed_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        unsubscribed_admin = create_user_with_profile(
            username="issues_close_unsubscribed_admin",
            email="issues_close_unsubscribed_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        ProjectMembership.objects.create(project=self.project, user=subscribed_admin)

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status",
            {"status": "DONE", "message": "done with subscriptions"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=subscribed_admin,
                notification__notify_type=NotifyType.ISSUE_CLOSED,
                notification__issue=self.issue,
            ).exists()
        )
        self.assertFalse(
            NotifyUser.objects.filter(
                user=unsubscribed_admin,
                notification__notify_type=NotifyType.ISSUE_CLOSED,
                notification__issue=self.issue,
            ).exists()
        )

    def test_assign_creates_notification_with_project(self):
        another_member = create_user_with_profile(
            username="issues_member_two",
            email="issues_member_two@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=another_member)

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [another_member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=another_member,
                notification__notify_type=NotifyType.ISSUE_ASSIGNED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_project_patch_team_does_not_remove_existing_admin_subscription(self):
        other_admin = create_user_with_profile(
            username="projects_admin_three",
            email="projects_admin_three@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        ProjectMembership.objects.create(project=self.project, user=other_admin)

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/projects/{self.project.project_id}",
            {"team": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            ProjectMembership.objects.filter(
                project=self.project,
                user=other_admin,
            ).exists()
        )

    def test_assign_creates_assign_event(self):
        another_member = create_user_with_profile(
            username="issues_member_event_assign",
            email="issues_member_event_assign@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=another_member)

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [another_member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            IssueEvent.objects.filter(
                issue=self.issue,
                actor=self.admin,
                event_type=EventType.ASSIGN,
            ).exists()
        )

    def test_unassign_creates_notification_with_project(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/unassign",
            {"userIds": [self.member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.ISSUE_UNASSIGNED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_unassign_creates_unassign_event(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/unassign",
            {"userIds": [self.member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            IssueEvent.objects.filter(
                issue=self.issue,
                actor=self.admin,
                event_type=EventType.UNASSIGN,
            ).exists()
        )

    @patch("apps.bugboardapi.modules.issues.commands.notify_issue_unassigned")
    def test_unassign_skips_inactive_users_in_notifications(self, mock_notify_issue_unassigned):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/unassign",
            {"userIds": [self.member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_notify_issue_unassigned.assert_not_called()

    def test_status_update_rejects_message_longer_than_1000(self):
        self.client.force_authenticate(user=self.member)
        too_long_message = "x" * 1001
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status",
            {"status": "DONE", "message": too_long_message},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "Must be at most 1000 characters")
        self.assertFalse(
            IssueEvent.objects.filter(
                issue=self.issue,
                actor=self.member,
                event_type=EventType.STATUS_CHANGE,
                message=too_long_message,
            ).exists()
        )

    def test_add_update_requires_message(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {"message": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_add_update_rejects_whitespace_only_message(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {"message": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "message is required")

    def test_add_update_rejects_message_longer_than_1000(self):
        self.client.force_authenticate(user=self.member)
        too_long_message = "x" * 1001
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {"message": too_long_message},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "Must be at most 1000 characters")
        self.assertFalse(
            IssueEvent.objects.filter(
                issue=self.issue,
                actor=self.member,
                event_type=EventType.COMMENT,
                message=too_long_message,
            ).exists()
        )

    def test_issue_updates_list_returns_events_for_project_member(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="visible update",
        )
        Attachment.objects.create(
            update=event,
            original_name="visible-file.txt",
            path="uploads/file.txt",
            mime_type="text/plain",
            size=12,
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/updates")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertIn("actorUsername", response.data[0])
        self.assertIn("attachments", response.data[0])
        self.assertEqual(
            response.data[0]["attachments"][0]["originalName"], "visible-file.txt"
        )

    def test_issue_updates_list_forbidden_for_outsider(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/updates")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_issue_update_invalid_attachment_rolls_back_comment(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {
                "message": "comment with invalid file",
                "file": "uploads/file.txt",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertFalse(
            IssueEvent.objects.filter(
                issue=self.issue,
                actor=self.member,
                event_type=EventType.COMMENT,
                message="comment with invalid file",
            ).exists()
        )

    def test_attachment_upload_requires_issue_access(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="comment",
        )
        self.client.force_authenticate(user=self.outsider)
        uploaded = SimpleUploadedFile(
            "notes.txt", b"hello outsider", content_type="text/plain"
        )
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments",
            {"file": uploaded},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_attachment_upload_success_for_assignee(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="comment",
        )
        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "notes.txt", b"hello assignee", content_type="text/plain"
        )
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments",
            {"file": uploaded},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        attachment = Attachment.objects.get(update=event)
        self.assertTrue(attachment.path.startswith(f"issue-attachments/{self.issue.issue_id}/"))
        self.assertEqual(attachment.original_name, "notes.txt")
        self.assertEqual(response.data["originalName"], "notes.txt")

    def test_attachment_upload_rejects_json_path_payload(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="comment",
        )
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments",
            {"path": "uploads/file.txt", "mimeType": "text/plain", "size": 12},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_issue_partial_update_creates_edit_event_and_notification(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"description": "Issue desc updated"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            IssueEvent.objects.filter(
                issue=self.issue,
                actor=self.member,
                event_type=EventType.EDIT,
            ).exists()
        )
        self.assertFalse(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_unassign_notifies_subscribed_admin_observer(self):
        observer_admin = create_user_with_profile(
            username="issues_unassign_observer_admin",
            email="issues_unassign_observer_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        ProjectMembership.objects.create(project=self.project, user=observer_admin)
        IssueAssignee.objects.create(issue=self.issue, user=observer_admin)

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/unassign",
            {"userIds": [self.member.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=observer_admin,
                notification__notify_type=NotifyType.ISSUE_UNASSIGNED,
                notification__issue=self.issue,
            ).exists()
        )

    def test_issue_comment_does_not_notify_issue_subscribed_admin_when_project_notifications_disabled(self):
        observer_admin = create_user_with_profile(
            username="issues_comment_blocked_admin",
            email="issues_comment_blocked_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        IssueAssignee.objects.create(issue=self.issue, user=observer_admin)

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {"message": "new comment"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(
            NotifyUser.objects.filter(
                user=observer_admin,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_issue_partial_update_notifies_subscribed_admin(self):
        IssueAssignee.objects.create(issue=self.issue, user=self.admin)

        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}",
            {"description": "Issue desc updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_issue_comment_does_not_notify_unsubscribed_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {"message": "new comment"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_issue_comment_notifies_subscribed_admin(self):
        IssueAssignee.objects.create(issue=self.issue, user=self.admin)

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {"message": "new comment"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
                notification__project=self.project,
            ).exists()
        )

    def test_issue_status_change_non_terminal_notifies_subscribed_admin(self):
        IssueAssignee.objects.create(issue=self.issue, user=self.admin)

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status",
            {"status": "IN_PROGRESS", "message": "progressing"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
            ).exists()
        )

    def test_issue_attachment_comment_notifies_subscribed_admin(self):
        IssueAssignee.objects.create(issue=self.issue, user=self.admin)

        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "notes.txt", b"hello attachment", content_type="text/plain"
        )

        response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "message": "file attached",
                "file": uploaded,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
            ).exists()
        )

    def test_issue_details_endpoint_updates_tags_and_fields(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/issues/{self.issue.issue_id}/details",
            {
                "title": "Details endpoint title",
                "description": "Updated via details endpoint",
                "status": "IN_PROGRESS",
                "priority": "MEDIUM",
                "tagNames": ["api", "frontend"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.title, "Details endpoint title")
        self.assertEqual(self.issue.status, IssueStatus.IN_PROGRESS)
        self.assertEqual(
            set(self.issue.tags.values_list("name", flat=True)), {"Api", "Frontend"}
        )

    def test_attachments_api_create_list_and_delete(self):
        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "manual.txt", b"manual upload", content_type="text/plain"
        )
        create_response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "message": "file attached",
                "file": uploaded,
            },
            format="multipart",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        attachment_id = create_response.data["attachmentId"]
        self.assertEqual(create_response.data["originalName"], "manual.txt")

        list_response = self.client.get(
            f"/api/attachments?issueId={self.issue.issue_id}"
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(item["attachmentId"] == attachment_id for item in list_response.data)
        )
        self.assertTrue(
            any(
                item["attachmentId"] == attachment_id
                and item["originalName"] == "manual.txt"
                for item in list_response.data
            )
        )

        delete_response = self.client.delete(f"/api/attachments/{attachment_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            Attachment.objects.filter(attachment_id=attachment_id).exists()
        )

    def test_attachments_api_multipart_upload_uses_abstract_storage(self):
        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "notes.txt", b"hello attachment", content_type="text/plain"
        )

        with TemporaryDirectory() as tmp_dir:
            with override_settings(MEDIA_ROOT=tmp_dir):
                response = self.client.post(
                    "/api/attachments",
                    {
                        "issueId": self.issue.issue_id,
                        "message": "file upload",
                        "file": uploaded,
                    },
                    format="multipart",
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                attachment = Attachment.objects.get(
                    attachment_id=response.data["attachmentId"]
                )
                self.assertTrue(
                    attachment.path.startswith(
                        f"issue-attachments/{self.issue.issue_id}/"
                    )
                )
                self.assertTrue(default_storage.exists(attachment.path))
                self.assertEqual(response.data["mimeType"], "text/plain")
                self.assertEqual(response.data["originalName"], "notes.txt")
                self.assertEqual(attachment.original_name, "notes.txt")
                self.assertGreater(response.data["size"], 0)
                self.assertTrue(response.data["url"].startswith("/media/"))

                delete_response = self.client.delete(
                    f"/api/attachments/{attachment.attachment_id}"
                )
                self.assertEqual(
                    delete_response.status_code, status.HTTP_204_NO_CONTENT
                )
                self.assertFalse(default_storage.exists(attachment.path))

    def test_attachments_api_compresses_image_before_storage(self):
        self.client.force_authenticate(user=self.member)
        raw_bytes = make_png_bytes(size=(2600, 2100))
        uploaded = SimpleUploadedFile("photo.png", raw_bytes, content_type="image/png")

        with patch(
            "apps.bugboardapi.security.uploads.default_storage.save",
            return_value=f"issue-attachments/{self.issue.issue_id}/compressed.webp",
        ) as save_mock:
            response = self.client.post(
                "/api/attachments",
                {
                    "issueId": self.issue.issue_id,
                    "message": "image upload",
                    "file": uploaded,
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        stored_file = save_mock.call_args.args[1]
        self.assertEqual(getattr(stored_file, "content_type", ""), "image/webp")
        self.assertLess(getattr(stored_file, "size", 0), len(raw_bytes))
        self.assertEqual(response.data["mimeType"], "image/webp")
        self.assertEqual(response.data["originalName"], "photo.webp")
        self.assertTrue(response.data["url"].endswith("/issue-attachments/%s/compressed.webp" % self.issue.issue_id))

    def test_attachments_api_returns_503_when_storage_backend_fails(self):
        self.client.force_authenticate(user=self.member)
        self.client.raise_request_exception = False
        uploaded = SimpleUploadedFile(
            "notes.txt", b"hello attachment", content_type="text/plain"
        )

        with patch(
            "apps.bugboardapi.security.uploads.default_storage.save",
            side_effect=RuntimeError("gcs unavailable"),
        ):
            response = self.client.post(
                "/api/attachments",
                {
                    "issueId": self.issue.issue_id,
                    "message": "file upload",
                    "file": uploaded,
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "Media storage is temporarily unavailable. Retry later.")
        self.assertFalse(Attachment.objects.filter(update__issue=self.issue).exists())

    def test_attachments_api_transcodes_video_to_mp4(self):
        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "demo.mov",
            make_fake_mp4_bytes(),
            content_type="video/quicktime",
        )

        def fake_ffmpeg_run(command, check, capture_output, text):
            Path(command[-1]).write_bytes(make_fake_mp4_bytes() + b"compressed")
            return subprocess.CompletedProcess(command, 0, "", "")

        with TemporaryDirectory() as tmp_dir:
            with override_settings(MEDIA_ROOT=tmp_dir):
                with patch(
                    "apps.bugboardapi.modules.issues.media.subprocess.run",
                    side_effect=fake_ffmpeg_run,
                ) as run_mock:
                    response = self.client.post(
                        "/api/attachments",
                        {
                            "issueId": self.issue.issue_id,
                            "message": "video upload",
                            "file": uploaded,
                        },
                        format="multipart",
                    )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                attachment = Attachment.objects.get(
                    attachment_id=response.data["attachmentId"]
                )
                self.assertEqual(response.data["mimeType"], "video/mp4")
                self.assertEqual(response.data["originalName"], "demo.mp4")
                self.assertEqual(attachment.original_name, "demo.mp4")
                self.assertTrue(attachment.path.endswith(".mp4"))
                self.assertTrue(default_storage.exists(attachment.path))
                self.assertGreater(response.data["size"], 0)
                self.assertTrue(run_mock.called)

    @override_settings(MEDIA_URL="https://storage.googleapis.com/test-bucket/")
    def test_attachment_serializer_uses_absolute_gcs_media_url(self):
        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "notes.txt", b"hello attachment", content_type="text/plain"
        )
        response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "message": "file upload",
                "file": uploaded,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            response.data["url"].startswith("https://storage.googleapis.com/test-bucket/")
        )

    def test_attachments_api_rejects_video_when_transcoding_fails(self):
        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "broken.mp4",
            make_fake_mp4_bytes(),
            content_type="video/mp4",
        )

        with patch(
            "apps.bugboardapi.modules.issues.media.subprocess.run",
            side_effect=subprocess.CalledProcessError(1, ["ffmpeg"]),
        ):
            response = self.client.post(
                "/api/attachments",
                {
                    "issueId": self.issue.issue_id,
                    "message": "broken video",
                    "file": uploaded,
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["file"],
            "Video file is invalid or could not be compressed",
        )

    def test_attachments_api_create_requires_target(self):
        self.client.force_authenticate(user=self.member)
        uploaded = SimpleUploadedFile(
            "manual.txt", b"manual upload", content_type="text/plain"
        )
        response = self.client.post(
            "/api/attachments",
            {"file": uploaded},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_attachments_api_rejects_json_path_payload(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "path": "uploads/manual.txt",
                "mimeType": "text/plain",
                "size": 33,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_issue_delete_requires_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.delete(
            f"/api/issues/{self.issue.issue_id}", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_issue_delete_requires_title_confirmation(self):
        self.client.force_authenticate(user=self.admin)
        no_confirm = self.client.delete(
            f"/api/issues/{self.issue.issue_id}", format="json"
        )
        self.assertEqual(no_confirm.status_code, status.HTTP_400_BAD_REQUEST)

        wrong_confirm = self.client.delete(
            f"/api/issues/{self.issue.issue_id}",
            {"title": "wrong"},
            format="json",
        )
        self.assertEqual(wrong_confirm.status_code, status.HTTP_400_BAD_REQUEST)

        ok_confirm = self.client.delete(
            f"/api/issues/{self.issue.issue_id}",
            {"title": self.issue.title},
            format="json",
        )
        self.assertEqual(ok_confirm.status_code, status.HTTP_204_NO_CONTENT)

    @patch("apps.bugboardapi.modules.issues.commands.notify_issue_updated")
    def test_issue_delete_does_not_emit_issue_updated_notification(self, mock_notify_issue_updated):
        inactive_assignee = create_user_with_profile(
            username="issues_member_delete_inactive",
            email="issues_member_delete_inactive@example.com",
            password="StrongPass123!",
        )
        another_member = create_user_with_profile(
            username="issues_member_delete_active",
            email="issues_member_delete_active@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=inactive_assignee)
        ProjectMembership.objects.create(project=self.project, user=another_member)
        IssueAssignee.objects.create(issue=self.issue, user=inactive_assignee)
        IssueAssignee.objects.create(issue=self.issue, user=another_member)
        inactive_assignee.is_active = False
        inactive_assignee.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            f"/api/issues/{self.issue.issue_id}",
            {"title": self.issue.title},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        mock_notify_issue_updated.assert_not_called()


class NotificationTagMetaEndpointTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="notify_admin",
            email="notify_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="notify_member",
            email="notify_member@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Notify Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Issue notify",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="LOW",
        )
        notify_issue_updated(users=[self.admin, self.member], issue=self.issue)

    def test_notifications_are_scoped_to_current_user(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("hasUnread", response.data)
        self.assertTrue(all(item["notifyUserId"] for item in response.data["results"]))
        ids = [item["notifyUserId"] for item in response.data["results"]]
        for notify_user_id in ids:
            self.assertTrue(
                NotifyUser.objects.filter(
                    notify_user_id=notify_user_id, user=self.member
                ).exists()
            )

    def test_read_single_notification_and_read_all(self):
        self.client.force_authenticate(user=self.member)
        notify_user = NotifyUser.objects.filter(user=self.member).first()
        single_response = self.client.post(
            f"/api/notifications/{notify_user.notify_user_id}/read", {}, format="json"
        )
        self.assertEqual(single_response.status_code, status.HTTP_200_OK)
        notify_user.refresh_from_db()
        self.assertTrue(notify_user.is_read)
        self.assertIsNotNone(notify_user.read_at)

        NotifyUser.objects.filter(user=self.member).update(is_read=False, read_at=None)
        all_response = self.client.post(
            "/api/notifications/read-all", {}, format="json"
        )
        self.assertEqual(all_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(all_response.data["updated"], 1)

        list_response = self.client.get("/api/notifications")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertFalse(list_response.data["hasUnread"])

    def test_delete_single_notification_for_current_user_only(self):
        self.client.force_authenticate(user=self.member)
        target = NotifyUser.objects.filter(user=self.member).first()
        self.assertIsNotNone(target)

        response = self.client.delete(
            f"/api/notifications/{target.notify_user_id}", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            NotifyUser.objects.filter(notify_user_id=target.notify_user_id).exists()
        )

    def test_delete_notification_does_not_allow_other_user_notification(self):
        admin_notification = NotifyUser.objects.filter(user=self.admin).first()
        self.assertIsNotNone(admin_notification)
        self.client.force_authenticate(user=self.member)

        response = self.client.delete(
            f"/api/notifications/{admin_notification.notify_user_id}", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_notification_removes_orphan_notification_row(self):
        single_notification = notify_issue_updated(users=[self.member], issue=self.issue)
        single_notify_user = NotifyUser.objects.get(
            notification=single_notification, user=self.member
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.delete(
            f"/api/notifications/{single_notify_user.notify_user_id}", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            Notification.objects.filter(
                notification_id=single_notification.notification_id
            ).exists()
        )

    def test_issue_notifications_set_project_from_issue(self):
        notification = notify_issue_updated(users=[self.member], issue=self.issue)
        self.assertEqual(notification.issue, self.issue)
        self.assertEqual(notification.project, self.project)

    def test_project_notifications_keep_project_context(self):
        notification = notify_project_added(users=[self.member], project=self.project)
        self.assertIsNone(notification.issue)
        self.assertEqual(notification.project, self.project)

    def test_issue_notifications_skip_actor_and_avoid_empty_notifications(self):
        notifications_before = NotifyUser.objects.filter(
            user=self.member,
            notification__notify_type=NotifyType.ISSUE_UPDATED,
            notification__issue=self.issue,
        ).count()
        notification = notify_issue_updated(users=[self.member], actor=self.member, issue=self.issue)
        self.assertIsNone(notification)
        self.assertEqual(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.ISSUE_UPDATED,
                notification__issue=self.issue,
            ).count(),
            notifications_before,
        )

    def test_issue_notification_payload_includes_project_id(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["hasUnread"])
        issue_notification = next(
            item for item in response.data["results"] if item["issueId"] == self.issue.issue_id
        )
        self.assertEqual(issue_notification["projectId"], self.project.project_id)

    def test_tags_create_and_delete_require_admin(self):
        self.client.force_authenticate(user=self.member)
        create_response = self.client.post(
            "/api/tags", {"name": "frontend"}, format="json"
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        create_response = self.client.post(
            "/api/tags", {"name": "frontend"}, format="json"
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        tag_id = create_response.data["tagId"]

        self.client.force_authenticate(user=self.member)
        delete_forbidden = self.client.delete(f"/api/tags/{tag_id}", format="json")
        self.assertEqual(delete_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        delete_ok = self.client.delete(f"/api/tags/{tag_id}", format="json")
        self.assertEqual(delete_ok.status_code, status.HTTP_204_NO_CONTENT)

    def test_tags_list_returns_alphabetical_names(self):
        Tag.objects.create(name="ops")
        Tag.objects.create(name="api")
        Tag.objects.create(name="frontend")

        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/tags")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["name"] for item in response.data],
            ["Api", "Frontend", "Ops"],
        )
        self.assertTrue(all("tagId" in item for item in response.data))

    def test_tags_create_normalizes_whitespace_and_casing(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/tags",
            {"name": "  fRoNtEnD  "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_tag = Tag.objects.get(tag_id=response.data["tagId"])
        self.assertEqual(created_tag.name, "Frontend")
        self.assertEqual(response.data["name"], "Frontend")

    def test_tags_create_rejects_duplicates_after_normalization(self):
        Tag.objects.create(name="frontend")
        self.client.force_authenticate(user=self.admin)
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/tags",
            {"name": " FRONTEND "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Tag.objects.filter(name__iexact="frontend").count(), 1)

    def test_tags_delete_removes_issue_relations_without_deleting_issue(self):
        tag = Tag.objects.create(name="frontend")
        IssueTag.objects.create(issue=self.issue, tag=tag)
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"/api/tags/{tag.tag_id}", format="json")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Issue.objects.filter(issue_id=self.issue.issue_id).exists())
        self.assertFalse(IssueTag.objects.filter(issue=self.issue, tag_id=tag.tag_id).exists())

    def test_tags_update_and_retrieve_are_not_exposed(self):
        self.client.force_authenticate(user=self.admin)
        tag = Tag.objects.create(name="ops")

        retrieve_response = self.client.get(f"/api/tags/{tag.tag_id}")
        self.assertEqual(retrieve_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        patch_response = self.client.patch(
            f"/api/tags/{tag.tag_id}",
            {"name": "platform"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
