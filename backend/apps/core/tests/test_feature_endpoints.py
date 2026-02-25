from datetime import timedelta

from django.contrib.auth import authenticate
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
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
        self.user = create_user_with_profile(
            username="otp_user",
            email="otp_user@example.com",
            password="StrongPass123!",
        )

    def test_otp_request_existing_user_creates_code(self):
        response = self.client.post("/api/auth/password/otp/request/", {"email": self.user.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PasswordResetOTP.objects.filter(user=self.user).count(), 1)

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


class UserManagementEndpointTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="users_admin",
            email="users_admin@example.com",
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
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["userId"], self.member.id)

    def test_admin_user_list_returns_multiple_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)

    def test_user_create_requires_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/users/",
            {"username": "new_user", "email": "new_user@example.com", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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

    def test_change_password_forbidden_for_other_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/change-password/",
            {"currentPassword": "StrongPass123!", "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


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
