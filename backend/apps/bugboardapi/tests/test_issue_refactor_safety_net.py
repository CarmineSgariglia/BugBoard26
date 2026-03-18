from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.bugboardapi.modules.issues.activity import create_attachment_for_event
from apps.bugboardapi.modules.issues.models import (
    Attachment,
    EventType,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueStatus,
)
from apps.bugboardapi.modules.notifications.models import NotifyType, NotifyUser
from apps.bugboardapi.modules.tags.models import Tag
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


class _MultiFilePayload(dict):
    def getlist(self, key):
        return self[key]


class IssueRefactorSafetyNetTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="issues_safety_admin",
            email="issues_safety_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="issues_safety_member",
            email="issues_safety_member@example.com",
            password="StrongPass123!",
        )
        self.another_member = create_user_with_profile(
            username="issues_safety_other",
            email="issues_safety_other@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Issues Safety Main",
            admin_members=[self.admin],
            developer_members=[self.member, self.another_member],
        )
        self.other_project = create_project_with_members(
            created_by=self.admin,
            name="Issues Safety Alt",
            admin_members=[self.admin],
            developer_members=[],
        )
        self.frontend_tag = Tag.objects.create(name="frontend")
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Safety net issue",
            description="Issue desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="HIGH",
        )
        IssueAssignee.objects.create(issue=self.issue, user=self.member)

    def test_issue_status_action_ignores_listing_filters_for_object_resolution(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status?projectId={self.other_project.project_id}&tag={self.frontend_tag.name}",
            {"status": "IN_PROGRESS", "message": "work started"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.status, IssueStatus.IN_PROGRESS)

    def test_status_update_to_same_value_is_a_no_op_for_events_and_notifications(self):
        self.issue.status = IssueStatus.DONE
        self.issue.save(update_fields=["status"])
        status_event_count = IssueEvent.objects.filter(
            issue=self.issue,
            event_type=EventType.STATUS_CHANGE,
        ).count()
        close_notification_count = NotifyUser.objects.filter(
            user=self.admin,
            notification__notify_type=NotifyType.ISSUE_CLOSED,
            notification__issue=self.issue,
        ).count()

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status",
            {"status": IssueStatus.DONE, "message": "still done"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.status, IssueStatus.DONE)
        self.assertEqual(
            IssueEvent.objects.filter(
                issue=self.issue,
                event_type=EventType.STATUS_CHANGE,
            ).count(),
            status_event_count,
        )
        self.assertEqual(
            NotifyUser.objects.filter(
                user=self.admin,
                notification__notify_type=NotifyType.ISSUE_CLOSED,
                notification__issue=self.issue,
            ).count(),
            close_notification_count,
        )

    def test_closed_issue_cannot_be_reopened_via_status_endpoint(self):
        self.issue.status = IssueStatus.CANCELLED
        self.issue.save(update_fields=["status"])
        status_event_count = IssueEvent.objects.filter(
            issue=self.issue,
            event_type=EventType.STATUS_CHANGE,
        ).count()

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/status",
            {"status": IssueStatus.IN_PROGRESS, "message": "resume work"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.status, IssueStatus.CANCELLED)
        self.assertEqual(
            IssueEvent.objects.filter(
                issue=self.issue,
                event_type=EventType.STATUS_CHANGE,
            ).count(),
            status_event_count,
        )

    def test_assigning_an_existing_assignee_is_a_no_op(self):
        assign_event_count = IssueEvent.objects.filter(
            issue=self.issue,
            event_type=EventType.ASSIGN,
        ).count()
        assigned_notification_count = NotifyUser.objects.filter(
            user=self.member,
            notification__notify_type=NotifyType.ISSUE_ASSIGNED,
            notification__issue=self.issue,
        ).count()

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/assign",
            {"userIds": [self.member.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            IssueAssignee.objects.filter(issue=self.issue, user=self.member).count(),
            1,
        )
        self.assertEqual(
            IssueEvent.objects.filter(
                issue=self.issue,
                event_type=EventType.ASSIGN,
            ).count(),
            assign_event_count,
        )
        self.assertEqual(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.ISSUE_ASSIGNED,
                notification__issue=self.issue,
            ).count(),
            assigned_notification_count,
        )

    def test_unassigning_a_user_who_is_not_assigned_is_a_no_op(self):
        unassign_event_count = IssueEvent.objects.filter(
            issue=self.issue,
            event_type=EventType.UNASSIGN,
        ).count()
        unassigned_notification_count = NotifyUser.objects.filter(
            user=self.another_member,
            notification__notify_type=NotifyType.ISSUE_UNASSIGNED,
            notification__issue=self.issue,
        ).count()

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/issues/{self.issue.issue_id}/unassign",
            {"userIds": [self.another_member.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            IssueAssignee.objects.filter(issue=self.issue, user=self.another_member).exists()
        )
        self.assertEqual(
            IssueEvent.objects.filter(
                issue=self.issue,
                event_type=EventType.UNASSIGN,
            ).count(),
            unassign_event_count,
        )
        self.assertEqual(
            NotifyUser.objects.filter(
                user=self.another_member,
                notification__notify_type=NotifyType.ISSUE_UNASSIGNED,
                notification__issue=self.issue,
            ).count(),
            unassigned_notification_count,
        )

    def test_attachment_create_requires_file_without_creating_issue_event(self):
        event_count = IssueEvent.objects.filter(issue=self.issue).count()

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "message": "attachment without file",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(IssueEvent.objects.filter(issue=self.issue).count(), event_count)

    def test_attachment_create_rejects_multiple_files_without_creating_issue_event(self):
        event_count = IssueEvent.objects.filter(issue=self.issue).count()

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "message": "too many files",
                "file": [
                    SimpleUploadedFile("one.txt", b"one", content_type="text/plain"),
                    SimpleUploadedFile("two.txt", b"two", content_type="text/plain"),
                ],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["file"], "Exactly one attachment file is required")
        self.assertEqual(IssueEvent.objects.filter(issue=self.issue).count(), event_count)

    def test_attachment_issue_lookup_is_scoped_to_visible_projects(self):
        self.client.force_authenticate(user=self.another_member)
        uploaded = SimpleUploadedFile(
            "notes.txt",
            b"hello",
            content_type="text/plain",
        )

        response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "file": uploaded,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        outsider = create_user_with_profile(
            username="issues_safety_outsider",
            email="issues_safety_outsider@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=outsider)
        uploaded = SimpleUploadedFile(
            "notes.txt",
            b"hello",
            content_type="text/plain",
        )
        response = self.client.post(
            "/api/attachments",
            {
                "issueId": self.issue.issue_id,
                "file": uploaded,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_attachment_event_lookup_is_scoped_to_visible_projects(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="comment",
        )

        self.client.force_authenticate(user=self.another_member)
        uploaded = SimpleUploadedFile(
            "notes.txt",
            b"hello",
            content_type="text/plain",
        )
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments",
            {"file": uploaded},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        outsider = create_user_with_profile(
            username="issues_safety_outsider_event",
            email="issues_safety_outsider_event@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=outsider)
        uploaded = SimpleUploadedFile(
            "notes.txt",
            b"hello",
            content_type="text/plain",
        )
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments",
            {"file": uploaded},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_attachment_event_upload_rejects_multiple_files(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="comment",
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/issue-events/{event.update_id}/attachments",
            {
                "file": [
                    SimpleUploadedFile("one.txt", b"one", content_type="text/plain"),
                    SimpleUploadedFile("two.txt", b"two", content_type="text/plain"),
                ],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["file"], "Exactly one attachment file is required")
        self.assertFalse(Attachment.objects.filter(update=event).exists())

    def test_partial_multifile_upload_does_not_leave_persisted_attachments(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="existing event",
        )
        payload = _MultiFilePayload(
            file=[
                object(),
                object(),
            ]
        )
        saved_path = f"issue-attachments/{self.issue.issue_id}/partial.txt"

        with (
            patch(
                "apps.bugboardapi.modules.issues.activity.save_issue_uploaded_file",
                side_effect=[
                    (saved_path, "text/plain", 12, "partial.txt"),
                    ValidationError({"file": "broken second file"}),
                ],
            ),
            patch("apps.bugboardapi.modules.issues.activity.delete_media_path") as delete_media_path_mock,
        ):
            with self.assertRaises(ValidationError):
                create_attachment_for_event(event, payload)

        self.assertFalse(
            Attachment.objects.filter(update=event, path=saved_path).exists()
        )
        delete_media_path_mock.assert_called_once_with(saved_path)

    def test_issue_delete_cleans_up_attachment_files(self):
        event = IssueEvent.objects.create(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="with attachment",
        )

        with TemporaryDirectory() as tmp_dir:
            relative_path = f"issue-attachments/{self.issue.issue_id}/delete-me.txt"
            absolute_path = Path(tmp_dir) / relative_path
            absolute_path.parent.mkdir(parents=True, exist_ok=True)
            absolute_path.write_text("delete me", encoding="utf-8")

            with override_settings(MEDIA_ROOT=tmp_dir):
                attachment = Attachment.objects.create(
                    update=event,
                    original_name="delete-me.txt",
                    path=relative_path,
                    mime_type="text/plain",
                    size=9,
                )

                self.client.force_authenticate(user=self.admin)
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.delete(
                        f"/api/issues/{self.issue.issue_id}",
                        {"title": self.issue.title},
                        format="json",
                    )

            self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
            self.assertFalse(absolute_path.exists())
            self.assertFalse(Attachment.objects.filter(pk=attachment.pk).exists())
