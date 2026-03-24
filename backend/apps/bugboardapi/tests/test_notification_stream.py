import json
from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITransactionTestCase

from apps.bugboardapi.modules.issues.models import Issue, IssueStatus
from apps.bugboardapi.modules.notifications.models import NotifyType, NotifyUser
from apps.bugboardapi.modules.projects.commands import delete_project_and_notify
from apps.bugboardapi.modules.notifications.services import (
    notify_issue_assigned,
    notify_issue_closed,
    notify_issue_updated,
)
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
        notify_issue_updated(users=[self.admin], issue=self.issue)
        member_notification = notify_issue_assigned(users=[self.member], issue=self.issue)
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
        first = notify_issue_updated(users=[self.member], issue=self.issue)
        second = notify_issue_closed(users=[self.member], issue=self.issue)
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

    def test_stream_ignores_invalid_last_event_id(self):
        notification = notify_issue_updated(users=[self.member], issue=self.issue)
        notify_user = NotifyUser.objects.get(notification=notification, user=self.member)

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            "/api/notifications/stream",
            HTTP_ACCEPT="text/event-stream",
            HTTP_LAST_EVENT_ID="not-a-number",
        )

        chunk = next(iter(response.streaming_content))
        parsed = _parse_sse_chunk(chunk)
        self.assertEqual(parsed["id"], str(notify_user.notify_user_id))
        response.close()

    def test_project_delete_stream_notifies_other_members_but_not_actor(self):
        admin_response = None
        member_response = None

        try:
            self.client.force_authenticate(user=self.admin)
            admin_response = self.client.get(
                "/api/notifications/stream",
                HTTP_ACCEPT="text/event-stream",
            )
            self.assertEqual(admin_response.status_code, status.HTTP_200_OK)

            self.client.force_authenticate(user=self.member)
            member_response = self.client.get(
                "/api/notifications/stream",
                HTTP_ACCEPT="text/event-stream",
            )
            self.assertEqual(member_response.status_code, status.HTTP_200_OK)

            delete_project_and_notify(project=self.project, actor=self.admin)

            member_chunk = next(iter(member_response.streaming_content))
            member_parsed = _parse_sse_chunk(member_chunk)
            member_payload = json.loads(member_parsed["data"])

            self.assertEqual(member_parsed["event"], "notification.created")
            self.assertEqual(member_payload["type"], NotifyType.PROJECT_REMOVED)
            self.assertFalse(
                NotifyUser.objects.filter(
                    notify_user_id=member_payload["notifyUserId"],
                    user=self.admin,
                ).exists()
            )

            admin_chunk = next(iter(admin_response.streaming_content))
            admin_parsed = _parse_sse_chunk(admin_chunk)
            self.assertEqual(admin_parsed["event"], "ping")
        finally:
            if admin_response is not None:
                admin_response.close()
            if member_response is not None:
                member_response.close()

    @patch("apps.bugboardapi.modules.notifications.views.open_notification_subscription")
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

    @patch("apps.bugboardapi.modules.notifications.views.open_notification_subscription", side_effect=RuntimeError)
    def test_stream_returns_service_unavailable_when_subscription_backend_fails(self, _mock_subscription):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/notifications/stream", HTTP_ACCEPT="text/event-stream")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
