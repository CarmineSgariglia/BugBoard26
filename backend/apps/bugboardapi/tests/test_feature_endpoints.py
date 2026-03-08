from datetime import timedelta
from io import StringIO
from pathlib import Path
import re
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone
from rest_framework import status
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.bugboardapi.models import (
    Attachment,
    EventType,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueStatus,
    Notification,
    NotifyType,
    NotifyUser,
    PasswordResetOTP,
    ProjectMembership,
    RevokedTokenSession,
    Tag,
)
from apps.bugboardapi.services.notifications import notify_users
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


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
        "apps.bugboardapi.services.users._send_otp_email",
        side_effect=RuntimeError("provider down"),
    )
    def test_otp_request_email_send_failure_returns_generic_and_logs_error(
        self, _mock_send
    ):
        with self.assertLogs(
            "apps.bugboardapi.services.users", level="ERROR"
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
    @patch("apps.bugboardapi.services.users.send_mail")
    def test_email_provider_console_default_in_dev(self, mock_send_mail):
        response = self.client.post(
            "/api/auth/password/otp/request", {"email": self.user.email}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_send_mail.called)

    @override_settings(EMAIL_PROVIDER="console")
    @patch("apps.bugboardapi.services.users.send_mail")
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
    @patch("apps.bugboardapi.services.users.EmailMessage.send", return_value=1)
    @patch("apps.bugboardapi.services.users.send_mail")
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

    def test_user_delete_endpoint_is_disabled(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/users/{self.member.id}")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
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
            "avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png"
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
        self.assertIn("/media/profile-images/", response.data["profileImg"])

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
            "avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png"
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

    def test_admin_upload_profile_image_for_other_user_via_admin_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        image = SimpleUploadedFile(
            "avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png"
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
            "avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png"
        )
        response = self.client.post(
            f"/api/users/{self.admin.id}/admin-upload-image",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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
        self.assertIsNotNone(membership)
        self.assertEqual(membership.role, ProjectMembership.Role.ADMIN)

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

    def test_members_endpoint_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/projects/{self.project.project_id}/members")
        self.assertIn(
            response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        )

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
                role=ProjectMembership.Role.DEVELOPER,
            ).exists()
        )
        self.assertFalse(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.member,
                role=ProjectMembership.Role.DEVELOPER,
            ).exists()
        )
        # Creator/admin membership must remain untouched.
        self.assertTrue(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.admin,
                role=ProjectMembership.Role.ADMIN,
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
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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
        self.assertEqual(issue_tag_names, {"api", "frontend"})
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
        self.assertEqual(issue_tag_names, {"api", "ops"})
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
        self.assertIsNotNone(self.issue.closed_at)

    def test_add_update_requires_message(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/updates",
            {"message": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_issue_updates_list_returns_events_for_project_member(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="visible update",
        )
        Attachment.objects.create(
            update=event, path="uploads/file.txt", mime_type="text/plain", size=12
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/updates")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertIn("actorUsername", response.data[0])
        self.assertIn("attachments", response.data[0])

    def test_issue_updates_list_forbidden_for_outsider(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/updates")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

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
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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
            set(self.issue.tags.values_list("name", flat=True)), {"api", "frontend"}
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

        list_response = self.client.get(
            f"/api/attachments?issueId={self.issue.issue_id}"
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(item["attachmentId"] == attachment_id for item in list_response.data)
        )

        delete_response = self.client.delete(f"/api/attachments/{attachment_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            Attachment.objects.filter(attachment_id=attachment_id).exists()
        )

    def test_attachments_api_multipart_upload_saves_file_on_disk(self):
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
                self.assertTrue((Path(tmp_dir) / attachment.path).exists())
                self.assertEqual(response.data["mimeType"], "text/plain")
                self.assertGreater(response.data["size"], 0)
                self.assertTrue(response.data["url"].startswith("/media/"))

                delete_response = self.client.delete(
                    f"/api/attachments/{attachment.attachment_id}"
                )
                self.assertEqual(
                    delete_response.status_code, status.HTTP_204_NO_CONTENT
                )
                self.assertFalse((Path(tmp_dir) / attachment.path).exists())

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
        notify_users(
            notify_type=NotifyType.ISSUE_UPDATED,
            users=[self.admin, self.member],
            issue=self.issue,
        )

    def test_notifications_are_scoped_to_current_user(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(item["notifyUserId"] for item in response.data))
        ids = [item["notifyUserId"] for item in response.data]
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
        single_notification = notify_users(
            notify_type=NotifyType.ISSUE_UPDATED, users=[self.member], issue=self.issue
        )
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

    def test_meta_enums_requires_auth_and_returns_payload(self):
        anon_response = self.client.get("/api/meta/enums")
        self.assertIn(
            anon_response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

        self.client.force_authenticate(user=self.member)
        auth_response = self.client.get("/api/meta/enums")
        self.assertEqual(auth_response.status_code, status.HTTP_200_OK)
        self.assertIn("issueType", auth_response.data)
        self.assertIn("issueStatus", auth_response.data)
        self.assertIn("priority", auth_response.data)


class OtpCleanupCommandTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="otp_cleanup_user",
            email="otp_cleanup_user@example.com",
            password="StrongPass123!",
        )

    def test_cleanup_otps_removes_used_and_expired_only(self):
        expired = PasswordResetOTP.objects.create(
            user=self.user,
            code="101010",
            expires_at=timezone.now() - timedelta(minutes=1),
            is_used=False,
        )
        used = PasswordResetOTP.objects.create(
            user=self.user,
            code="202020",
            expires_at=timezone.now() + timedelta(minutes=10),
            is_used=True,
        )
        valid = PasswordResetOTP.objects.create(
            user=self.user,
            code="303030",
            expires_at=timezone.now() + timedelta(minutes=10),
            is_used=False,
        )
        expired_session = RevokedTokenSession.objects.create(
            sid="expired-session",
            user=self.user,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        valid_session = RevokedTokenSession.objects.create(
            sid="valid-session",
            user=self.user,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        output = StringIO()
        call_command("cleanup_otps", stdout=output)

        self.assertFalse(
            PasswordResetOTP.objects.filter(otp_id=expired.otp_id).exists()
        )
        self.assertFalse(PasswordResetOTP.objects.filter(otp_id=used.otp_id).exists())
        self.assertTrue(PasswordResetOTP.objects.filter(otp_id=valid.otp_id).exists())
        self.assertFalse(RevokedTokenSession.objects.filter(sid=expired_session.sid).exists())
        self.assertTrue(RevokedTokenSession.objects.filter(sid=valid_session.sid).exists())
        self.assertIn("Deleted", output.getvalue())
