from io import BytesIO

from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bugboardapi.modules.issues.models import Attachment, EventType, Issue, IssueEvent, IssueStatus
from apps.bugboardapi.modules.notifications.services import notify_issue_updated
from apps.bugboardapi.modules.tags.models import Tag
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


def make_png_bytes(*, size: tuple[int, int], color: str = "blue") -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color=color).save(buffer, format="PNG")
    return buffer.getvalue()


class FrontendContractTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="contract_admin",
            email="contract_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="contract_member",
            email="contract_member@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Contract Project",
            icon="folder",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.tag = Tag.objects.create(name="contract-tag")
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Contract issue",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="MEDIUM",
        )
        notify_issue_updated(users=[self.member], issue=self.issue)

    def test_auth_me_payload_matches_frontend_contract(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_keys = {"userId", "username", "email", "firstName", "lastName", "isAdmin", "profileImg", "active"}
        self.assertTrue(expected_keys.issubset(set(response.data.keys())))

    def test_users_list_payload_matches_frontend_contract(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/users?page=1&search=contract&role=User&status=Active")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_top_level_keys = {"count", "next", "previous", "results"}
        self.assertTrue(expected_top_level_keys.issubset(set(response.data.keys())))
        self.assertGreaterEqual(len(response.data["results"]), 1)
        expected_user_keys = {"userId", "username", "email", "firstName", "lastName", "isAdmin", "profileImg", "active"}
        self.assertTrue(expected_user_keys.issubset(set(response.data["results"][0].keys())))

    def test_projects_list_payload_matches_frontend_contract(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/projects")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        expected_keys = {"projectId", "name", "createdAt", "description", "color", "icon", "createdBy", "authorProfileImg"}
        self.assertTrue(expected_keys.issubset(set(response.data[0].keys())))
        self.assertEqual(response.data[0]["icon"], "folder")

    def test_project_issues_payload_matches_frontend_contract(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/projects/{self.project.project_id}/issues")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        expected_keys = {
            "issueId",
            "projectId",
            "reporterId",
            "reporter",
            "title",
            "description",
            "type",
            "status",
            "priority",
            "createdAt",
        }
        self.assertTrue(expected_keys.issubset(set(response.data[0].keys())))
        reporter_keys = {"userId", "username", "email", "firstName", "lastName", "isAdmin", "profileImg", "active"}
        self.assertTrue(reporter_keys.issubset(set(response.data[0]["reporter"].keys())))

    def test_notifications_payload_matches_frontend_contract(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("nextCursor", response.data)
        self.assertIn("hasMore", response.data)
        self.assertIn("hasUnread", response.data)
        self.assertGreaterEqual(len(response.data["results"]), 1)
        expected_keys = {"notifyUserId", "notificationId", "type", "createdAt", "issueId", "projectId", "isRead", "readAt"}
        self.assertTrue(expected_keys.issubset(set(response.data["results"][0].keys())))
        self.assertEqual(response.data["results"][0]["issueId"], self.issue.issue_id)
        self.assertEqual(response.data["results"][0]["projectId"], self.project.project_id)
        self.assertTrue(response.data["hasUnread"])

    def test_read_notification_contract(self):
        self.client.force_authenticate(user=self.member)
        list_response = self.client.get("/api/notifications")
        notify_user_id = list_response.data["results"][0]["notifyUserId"]
        read_response = self.client.post(f"/api/notifications/{notify_user_id}/read", {}, format="json")
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertTrue(read_response.data["isRead"])

    def test_issue_updates_attachment_payload_matches_frontend_contract(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="Attachment contract",
        )
        Attachment.objects.create(
            update=event,
            original_name="contract-file.txt",
            path="uploads/abc123.txt",
            mime_type="text/plain",
            size=42,
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/updates")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertIn("attachments", response.data[0])
        self.assertGreaterEqual(len(response.data[0]["attachments"]), 1)

        expected_attachment_keys = {
            "attachmentId",
            "updateId",
            "originalName",
            "path",
            "url",
            "mimeType",
            "size",
            "uploadedAt",
        }
        self.assertTrue(expected_attachment_keys.issubset(set(response.data[0]["attachments"][0].keys())))
        self.assertEqual(response.data[0]["attachments"][0]["originalName"], "contract-file.txt")

    def test_settings_update_and_change_password_contract(self):
        self.client.force_authenticate(user=self.member)

        patch_response = self.client.patch(
            f"/api/users/{self.member.id}",
            {"username": "contract_member_renamed", "firstName": "Contract", "lastName": "User"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["username"], "contract_member_renamed")
        self.assertEqual(patch_response.data["firstName"], "Contract")
        self.assertEqual(patch_response.data["lastName"], "User")

        change_password_response = self.client.post(
            f"/api/users/{self.member.id}/change-password",
            {"currentPassword": "StrongPass123!", "newPassword": "NewStrongPass123!"},
            format="json",
        )
        self.assertEqual(change_password_response.status_code, status.HTTP_200_OK)
        self.assertEqual(change_password_response.data["detail"], "Password updated")

    def test_profile_image_upload_contract_uses_canonical_kebab_case_path(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

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
        self.assertIn("profileImg", response.data)

    def test_admin_reset_other_user_password_contract(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.member.id}/admin-reset-password",
            {"newPassword": "AdminResetPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "Password updated")

    def test_memberships_payload_contract(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/projects/{self.project.project_id}/members")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        expected_keys = {"projectMembershipId", "projectId", "userId", "username", "firstName", "lastName", "email", "role"}
        self.assertTrue(expected_keys.issubset(set(response.data[0].keys())))
        returned_user_ids = {item["userId"] for item in response.data}
        self.assertNotIn(self.admin.id, returned_user_ids)
