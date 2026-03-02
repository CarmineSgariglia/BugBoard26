from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.core.models import (
    Attachment,
    EventType,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueStatus,
    NotifyType,
    NotifyUser,
    PasswordResetOTP,
    ProjectMembership,
    Tag,
)
from apps.core.serializers import notify_users
from apps.core.tests.utils import create_project_with_members, create_user_with_profile


class AuthOtpEndpointTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = create_user_with_profile(
            username="otp_user",
            email="otp_user@example.com",
            password="StrongPass123!",
        )

    def test_otp_request_existing_user_creates_code(self):
        response = self.client.post("/api/auth/password/otp/request/", {"email": self.user.email}, format="json")
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
        response = self.client.post("/api/auth/password/otp/request/", {"email": self.user.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        old.refresh_from_db()
        self.assertTrue(old.is_used)
        self.assertEqual(PasswordResetOTP.objects.filter(user=self.user).count(), 2)

    def test_otp_request_unknown_user_returns_generic_message(self):
        response = self.client.post("/api/auth/password/otp/request/", {"email": "missing@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PasswordResetOTP.objects.count(), 0)

    def test_otp_verify_and_reset_flow(self):
        otp = PasswordResetOTP.objects.create(
            user=self.user,
            code="123456",
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        verify_response = self.client.post(
            "/api/auth/password/otp/verify/",
            {"email": self.user.email, "code": otp.code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_response.data["valid"])

        reset_response = self.client.post(
            "/api/auth/password/reset/",
            {"email": self.user.email, "code": otp.code, "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)
        otp.refresh_from_db()
        self.assertTrue(otp.is_used)
        self.assertTrue(authenticate(username=self.user.username, password="NewStrongPass123!"))

    def test_otp_verify_rejects_expired_code(self):
        PasswordResetOTP.objects.create(
            user=self.user,
            code="654321",
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        response = self.client.post(
            "/api/auth/password/otp/verify/",
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
            "/api/auth/password/otp/verify/",
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
                "/api/auth/password/otp/verify/",
                {"email": self.user.email, "code": "000000"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertFalse(response.data["valid"])
        otp.refresh_from_db()
        self.assertEqual(otp.attempt_count, 5)
        self.assertTrue(otp.is_used)

    def test_password_reset_rejects_expired_or_locked_otp(self):
        expired = PasswordResetOTP.objects.create(
            user=self.user,
            code="555555",
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        expired_response = self.client.post(
            "/api/auth/password/reset/",
            {"email": self.user.email, "code": expired.code, "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(expired_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", expired_response.data)

        locked = PasswordResetOTP.objects.create(
            user=self.user,
            code="666666",
            expires_at=timezone.now() + timedelta(minutes=5),
            is_used=True,
        )
        locked_response = self.client.post(
            "/api/auth/password/reset/",
            {"email": self.user.email, "code": locked.code, "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(locked_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", locked_response.data)

    @patch("apps.core.services.password_reset._send_otp_email", side_effect=RuntimeError("provider down"))
    def test_otp_request_email_send_failure_returns_generic_and_logs_error(self, _mock_send):
        with self.assertLogs("apps.core.services.password_reset", level="ERROR") as logs:
            response = self.client.post("/api/auth/password/otp/request/", {"email": self.user.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        self.assertTrue(any("otp_request_send_failed" in message for message in logs.output))

    @override_settings(EMAIL_PROVIDER="console")
    @patch("apps.core.services.password_reset.send_mail")
    def test_email_provider_console_default_in_dev(self, mock_send_mail):
        response = self.client.post("/api/auth/password/otp/request/", {"email": self.user.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_send_mail.called)

    @override_settings(
        EMAIL_PROVIDER="brevo",
        BREVO_OTP_TEMPLATE_ID="123",
        DEFAULT_FROM_EMAIL="noreply@example.com",
        BREVO_SENDER_NAME="BugBoard26",
    )
    @patch("apps.core.services.password_reset.EmailMessage.send", return_value=1)
    @patch("apps.core.services.password_reset.send_mail")
    def test_email_provider_brevo_uses_anymail_backend(self, mock_send_mail, _mock_email_send):
        response = self.client.post("/api/auth/password/otp/request/", {"email": self.user.email}, format="json")
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
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["userId"], self.member.id)

    def test_admin_user_list_returns_multiple_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)
        self.assertGreaterEqual(response.data["count"], 2)
        self.assertGreaterEqual(len(response.data["results"]), 2)

    def test_admin_user_list_search_filter(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users/?search=users_member")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["userId"], self.member.id)

    def test_admin_user_list_role_filter_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users/?role=Admin")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 2)
        self.assertTrue(all(user["isAdmin"] for user in response.data["results"]))

    def test_admin_user_list_role_filter_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users/?role=User")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)
        self.assertTrue(all(not user["isAdmin"] for user in response.data["results"]))

    def test_admin_user_list_status_filter_active_and_inactive(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])
        self.member.profile.active = False
        self.member.profile.save(update_fields=["active"])

        self.client.force_authenticate(user=self.admin)
        active_response = self.client.get("/api/users/?status=Active")
        inactive_response = self.client.get("/api/users/?status=Inactive")

        self.assertEqual(active_response.status_code, status.HTTP_200_OK)
        self.assertEqual(inactive_response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(user["active"] for user in active_response.data["results"]))
        self.assertTrue(all(not user["active"] for user in inactive_response.data["results"]))

    def test_admin_user_list_combined_filters(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users/?search=users_admin_other&role=Admin&status=Active")
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
        response = self.client.get("/api/users/?page=2")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["previous"])
        self.assertGreater(response.data["count"], 10)
        self.assertGreaterEqual(len(response.data["results"]), 1)

    def test_user_create_requires_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/users/",
            {"username": "new_user", "email": "new_user@example.com", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_delete_endpoint_is_disabled(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/users/{self.member.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(id=self.member.id).exists())

    def test_admin_can_disable_user_with_confirmation(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/disable/",
            {"username": self.member.username},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)
        self.assertFalse(self.member.profile.active)

    def test_admin_can_toggle_user_status_with_status_endpoint(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])
        self.member.profile.active = False
        self.member.profile.save(update_fields=["active"])

        self.client.force_authenticate(user=self.admin)
        activate = self.client.post(
            f"/api/users/{self.member.id}/status/",
            {"active": True},
            format="json",
        )
        self.assertEqual(activate.status_code, status.HTTP_200_OK)
        self.assertTrue(activate.data["active"])

        deactivate = self.client.post(
            f"/api/users/{self.member.id}/status/",
            {"active": False},
            format="json",
        )
        self.assertEqual(deactivate.status_code, status.HTTP_200_OK)
        self.assertFalse(deactivate.data["active"])

    def test_profile_image_upload_self_success(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile("avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png")
        response = self.client.post(
            f"/api/users/{self.member.id}/profile-image/",
            {"image": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.profile.profile_img.startswith(f"profile-images/{self.member.id}/"))
        self.assertIn("/media/profile-images/", response.data["profileImg"])

    def test_profile_image_upload_rejects_invalid_type(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile("avatar.txt", b"not-image", content_type="text/plain")
        response = self.client.post(
            f"/api/users/{self.member.id}/profile-image/",
            {"image": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_profile_image_upload_rejects_too_large(self):
        self.client.force_authenticate(user=self.member)
        big_bytes = b"a" * (2 * 1024 * 1024 + 1)
        image = SimpleUploadedFile("big.png", big_bytes, content_type="image/png")
        response = self.client.post(
            f"/api/users/{self.member.id}/profile-image/",
            {"image": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_profile_image_upload_me_endpoint_with_profile_img_field(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile("avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png")
        response = self.client.post(
            "/api/users/me/upload_profile_image/",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.profile.profile_img.startswith(f"profile-images/{self.member.id}/"))

    def test_admin_upload_profile_image_for_other_user_via_admin_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        image = SimpleUploadedFile("avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png")
        response = self.client.post(
            f"/api/users/{self.member.id}/admin-upload-image/",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.profile.profile_img.startswith(f"profile-images/{self.member.id}/"))

    def test_non_admin_cannot_use_admin_upload_profile_image_endpoint(self):
        self.client.force_authenticate(user=self.member)
        image = SimpleUploadedFile("avatar.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png")
        response = self.client.post(
            f"/api/users/{self.admin.id}/admin-upload-image/",
            {"profile_img": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_change_password_success(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password/",
            {"currentPassword": "StrongPass123!", "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("NewStrongPass123!"))

    def test_change_password_rejects_wrong_current(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password/",
            {"currentPassword": "wrong-pass", "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currentPassword", response.data)

    def test_admin_can_reset_password_for_other_user_without_current(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password/",
            {"newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("NewStrongPass123!"))

    def test_admin_can_reset_password_for_other_user_via_admin_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/admin-reset-password/",
            {"newPassword": "AdminEndpointPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("AdminEndpointPass123!"))

    def test_non_admin_cannot_use_admin_reset_password_endpoint(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.admin.id}/admin-reset-password/",
            {"newPassword": "AdminEndpointPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_reset_password_for_other_admin_without_current(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.other_admin.id}/change-password/",
            {"newPassword": "AnotherStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_admin.refresh_from_db()
        self.assertTrue(self.other_admin.check_password("AnotherStrongPass123!"))

    def test_non_admin_cannot_change_other_user_password(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/users/{self.admin.id}/change-password/",
            {"newPassword": "AnotherStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_self_change_requires_current_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.admin.id}/change-password/",
            {"newPassword": "AnotherStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currentPassword", response.data)

    def test_admin_reset_rejects_same_password_as_current_target_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password/",
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
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_project_create_adds_admin_as_member(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/projects/",
            {"name": "New Admin Project", "description": "D", "color": "#111111", "icon": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project_id = response.data["projectId"]
        membership = ProjectMembership.objects.filter(project_id=project_id, user=self.admin).first()
        self.assertIsNotNone(membership)
        self.assertEqual(membership.role, ProjectMembership.Role.ADMIN)

    def test_members_endpoint_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/projects/{self.project.project_id}/members/")
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_admin_can_add_and_remove_member(self):
        self.client.force_authenticate(user=self.admin)
        add_response = self.client.post(
            f"/api/projects/{self.project.project_id}/members/",
            {"userId": self.outsider.id, "role": ProjectMembership.Role.DEVELOPER},
            format="json",
        )
        self.assertEqual(add_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ProjectMembership.objects.filter(project=self.project, user=self.outsider).exists())

        remove_response = self.client.delete(
            f"/api/projects/{self.project.project_id}/members/{self.outsider.id}/",
            format="json",
        )
        self.assertEqual(remove_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProjectMembership.objects.filter(project=self.project, user=self.outsider).exists())

    def test_add_member_rejects_invalid_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/members/",
            {"userId": self.outsider.id, "role": "owner"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_add_member_rejects_inactive_user(self):
        self.outsider.is_active = False
        self.outsider.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/projects/{self.project.project_id}/members/",
            {"userId": self.outsider.id, "role": ProjectMembership.Role.DEVELOPER},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userId", response.data)

    def test_cannot_remove_project_creator_membership(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            f"/api/projects/{self.project.project_id}/members/{self.admin.id}/",
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_remove_last_project_admin(self):
        second_admin = create_user_with_profile(
            username="projects_second_admin",
            email="projects_second_admin@example.com",
            password="StrongPass123!",
        )
        ProjectMembership.objects.create(project=self.project, user=second_admin, role=ProjectMembership.Role.ADMIN)

        self.client.force_authenticate(user=self.admin)
        first_remove = self.client.delete(
            f"/api/projects/{self.project.project_id}/members/{second_admin.id}/",
            format="json",
        )
        self.assertEqual(first_remove.status_code, status.HTTP_204_NO_CONTENT)

        second_remove = self.client.delete(
            f"/api/projects/{self.project.project_id}/members/{self.admin.id}/",
            format="json",
        )
        self.assertEqual(second_remove.status_code, status.HTTP_400_BAD_REQUEST)

    def test_project_delete_requires_name_confirmation(self):
        self.client.force_authenticate(user=self.admin)
        no_confirm = self.client.delete(f"/api/projects/{self.project.project_id}/", format="json")
        self.assertEqual(no_confirm.status_code, status.HTTP_400_BAD_REQUEST)

        wrong_confirm = self.client.delete(
            f"/api/projects/{self.project.project_id}/",
            {"name": "wrong"},
            format="json",
        )
        self.assertEqual(wrong_confirm.status_code, status.HTTP_400_BAD_REQUEST)

        ok_confirm = self.client.delete(
            f"/api/projects/{self.project.project_id}/",
            {"name": self.project.name},
            format="json",
        )
        self.assertEqual(ok_confirm.status_code, status.HTTP_204_NO_CONTENT)


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
        response = self.client.get(f"/api/projects/{self.project.project_id}/issues/")
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
        response = self.client.post(f"/api/projects/{self.project.project_id}/issues/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_issue = Issue.objects.get(issue_id=response.data["issueId"])
        self.assertTrue(IssueEvent.objects.filter(issue=new_issue, event_type=EventType.CREATE).exists())

    def test_assign_requires_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign/",
            {"userIds": [self.member.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assign_rejects_non_member_assignee(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign/",
            {"userIds": [self.outsider.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userIds", response.data)

    def test_assignee_can_change_status_to_done(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status/",
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
            f"/api/issues/{self.issue.issue_id}/updates/",
            {"message": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_attachment_upload_requires_issue_access(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="comment",
        )
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments/",
            {"path": "uploads/file.txt", "mimeType": "text/plain", "size": 12},
            format="json",
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
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments/",
            {"path": "uploads/file.txt", "mimeType": "text/plain", "size": 12},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Attachment.objects.filter(update=event, path="uploads/file.txt").exists())

    def test_issue_delete_requires_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.delete(f"/api/issues/{self.issue.issue_id}/", format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_issue_delete_requires_title_confirmation(self):
        self.client.force_authenticate(user=self.admin)
        no_confirm = self.client.delete(f"/api/issues/{self.issue.issue_id}/", format="json")
        self.assertEqual(no_confirm.status_code, status.HTTP_400_BAD_REQUEST)

        wrong_confirm = self.client.delete(
            f"/api/issues/{self.issue.issue_id}/",
            {"title": "wrong"},
            format="json",
        )
        self.assertEqual(wrong_confirm.status_code, status.HTTP_400_BAD_REQUEST)

        ok_confirm = self.client.delete(
            f"/api/issues/{self.issue.issue_id}/",
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
        notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=[self.admin, self.member], issue=self.issue)

    def test_notifications_are_scoped_to_current_user(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(item["notifyUserId"] for item in response.data))
        ids = [item["notifyUserId"] for item in response.data]
        for notify_user_id in ids:
            self.assertTrue(NotifyUser.objects.filter(notify_user_id=notify_user_id, user=self.member).exists())

    def test_read_single_notification_and_read_all(self):
        self.client.force_authenticate(user=self.member)
        notify_user = NotifyUser.objects.filter(user=self.member).first()
        single_response = self.client.post(f"/api/notifications/{notify_user.notify_user_id}/read/", {}, format="json")
        self.assertEqual(single_response.status_code, status.HTTP_200_OK)
        notify_user.refresh_from_db()
        self.assertTrue(notify_user.is_read)
        self.assertIsNotNone(notify_user.read_at)

        NotifyUser.objects.filter(user=self.member).update(is_read=False, read_at=None)
        all_response = self.client.post("/api/notifications/read-all/", {}, format="json")
        self.assertEqual(all_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(all_response.data["updated"], 1)

    def test_tags_create_and_delete_require_admin(self):
        self.client.force_authenticate(user=self.member)
        create_response = self.client.post("/api/tags/", {"name": "frontend"}, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        create_response = self.client.post("/api/tags/", {"name": "frontend"}, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        tag_id = create_response.data["tagId"]

        self.client.force_authenticate(user=self.member)
        delete_forbidden = self.client.delete(f"/api/tags/{tag_id}/", format="json")
        self.assertEqual(delete_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        delete_ok = self.client.delete(f"/api/tags/{tag_id}/", format="json")
        self.assertEqual(delete_ok.status_code, status.HTTP_204_NO_CONTENT)

    def test_meta_enums_requires_auth_and_returns_payload(self):
        anon_response = self.client.get("/api/meta/enums/")
        self.assertIn(anon_response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

        self.client.force_authenticate(user=self.member)
        auth_response = self.client.get("/api/meta/enums/")
        self.assertEqual(auth_response.status_code, status.HTTP_200_OK)
        self.assertIn("issueType", auth_response.data)
        self.assertIn("issueStatus", auth_response.data)
        self.assertIn("priority", auth_response.data)
