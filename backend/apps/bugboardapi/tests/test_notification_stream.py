import json
from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITransactionTestCase

from apps.bugboardapi.models import Issue, IssueStatus, NotifyType, NotifyUser
from apps.bugboardapi.services.notifications import notify_users
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


def _decode_chunk(chunk) -> str:
    return chunk.decode() if isinstance(chunk, bytes) else str(chunk)


def _parse_sse_chunk(chunk) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for line in _decode_chunk(chunk).strip().splitlines():
        if ": " not in line:
            continue
        key, value = line.split(": ", 1)
        parsed[key] = value
    return parsed


class NotificationStreamTests(APITransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.admin = create_user_with_profile(
            username="stream_admin",
            email="stream_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="stream_member",
            email="stream_member@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Stream Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Realtime issue",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="MEDIUM",
        )

    def test_stream_requires_authentication(self):
        response = self.client.get("/api/notifications/stream", HTTP_ACCEPT="text/event-stream")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stream_emits_only_current_user_notifications(self):
        notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=[self.admin], issue=self.issue)
        member_notification = notify_users(
            notify_type=NotifyType.ISSUE_ASSIGNED,
            users=[self.member],
            issue=self.issue,
        )
        member_notify_user = NotifyUser.objects.get(notification=member_notification, user=self.member)

        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications/stream", HTTP_ACCEPT="text/event-stream")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        chunk = next(iter(response.streaming_content))

        parsed = _parse_sse_chunk(chunk)
        self.assertEqual(parsed["event"], "notification.created")
        self.assertEqual(parsed["id"], str(member_notify_user.notify_user_id))

        payload = json.loads(parsed["data"])
        self.assertEqual(payload["notifyUserId"], member_notify_user.notify_user_id)
        self.assertEqual(payload["type"], NotifyType.ISSUE_ASSIGNED)
        self.assertEqual(payload["issueId"], self.issue.issue_id)
        self.assertEqual(payload["projectId"], self.project.project_id)
        self.assertFalse(NotifyUser.objects.filter(notify_user_id=payload["notifyUserId"], user=self.admin).exists())
        response.close()

    def test_stream_resumes_from_last_event_id(self):
        first = notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=[self.member], issue=self.issue)
        second = notify_users(notify_type=NotifyType.ISSUE_CLOSED, users=[self.member], issue=self.issue)
        first_notify_user = NotifyUser.objects.get(notification=first, user=self.member)
        second_notify_user = NotifyUser.objects.get(notification=second, user=self.member)

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            "/api/notifications/stream",
            HTTP_ACCEPT="text/event-stream",
            HTTP_LAST_EVENT_ID=str(first_notify_user.notify_user_id),
        )

        chunk = next(iter(response.streaming_content))

        parsed = _parse_sse_chunk(chunk)
        payload = json.loads(parsed["data"])
        self.assertEqual(parsed["id"], str(second_notify_user.notify_user_id))
        self.assertEqual(payload["notifyUserId"], second_notify_user.notify_user_id)
        self.assertEqual(payload["type"], NotifyType.ISSUE_CLOSED)
        response.close()

    @patch("apps.bugboardapi.views.notifications.open_notification_subscription")
    def test_stream_sends_heartbeat_and_headers(self, open_subscription_mock):
        class StubSubscription:
            def get_message(self, timeout=None):
                return None

            def close(self):
                return None

        open_subscription_mock.return_value = StubSubscription()
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications/stream", HTTP_ACCEPT="text/event-stream")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertEqual(response["X-Accel-Buffering"], "no")
        self.assertIn("text/event-stream", response["Content-Type"])

        chunk = next(iter(response.streaming_content))

        parsed = _parse_sse_chunk(chunk)
        self.assertEqual(parsed["event"], "ping")
        response.close()
