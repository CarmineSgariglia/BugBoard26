import json
from unittest.mock import patch

from django.db import transaction
from rest_framework import status
from rest_framework.test import APITransactionTestCase

from apps.bugboardapi.models import EventType, Issue, IssueStatus
from apps.bugboardapi.services import create_issue_event
from apps.bugboardapi.services.issue_realtime import open_issue_subscription
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


class IssueUpdateStreamTests(APITransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.admin = create_user_with_profile(
            username="issue_stream_admin",
            email="issue_stream_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="issue_stream_member",
            email="issue_stream_member@example.com",
            password="StrongPass123!",
        )
        self.other_member = create_user_with_profile(
            username="issue_stream_other",
            email="issue_stream_other@example.com",
            password="StrongPass123!",
        )
        self.outsider = create_user_with_profile(
            username="issue_stream_outsider",
            email="issue_stream_outsider@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Issue Stream Project",
            admin_members=[self.admin],
            developer_members=[self.member, self.other_member],
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
        self.other_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Other realtime issue",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="LOW",
        )

    def test_issue_update_stream_requires_authentication(self):
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/updates/stream", HTTP_ACCEPT="text/event-stream")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_issue_update_stream_denies_users_without_access(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/issues/{self.issue.issue_id}/updates/stream", HTTP_ACCEPT="text/event-stream")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_issue_update_stream_emits_only_events_for_the_requested_issue(self):
        issue_event = create_issue_event(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="Visible comment",
        )
        create_issue_event(
            issue=self.other_issue,
            actor=self.other_member,
            event_type=EventType.STATUS_CHANGE,
            message="Should not leak",
            old_status=IssueStatus.TODO,
            new_status=IssueStatus.DONE,
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/issues/{self.issue.issue_id}/updates/stream",
            HTTP_ACCEPT="text/event-stream",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        chunk = next(iter(response.streaming_content))

        parsed = _parse_sse_chunk(chunk)
        payload = json.loads(parsed["data"])

        self.assertEqual(parsed["event"], "issue.event.created")
        self.assertEqual(parsed["id"], str(issue_event.update_id))
        self.assertEqual(payload["updateId"], issue_event.update_id)
        self.assertEqual(payload["issueId"], self.issue.issue_id)
        self.assertEqual(payload["message"], "Visible comment")
        response.close()

    def test_issue_update_stream_resumes_from_last_event_id(self):
        first_event = create_issue_event(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="First",
        )
        second_event = create_issue_event(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.STATUS_CHANGE,
            message="Closed",
            old_status=IssueStatus.TODO,
            new_status=IssueStatus.DONE,
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/issues/{self.issue.issue_id}/updates/stream",
            HTTP_ACCEPT="text/event-stream",
            HTTP_LAST_EVENT_ID=str(first_event.update_id),
        )

        chunk = next(iter(response.streaming_content))
        parsed = _parse_sse_chunk(chunk)
        payload = json.loads(parsed["data"])

        self.assertEqual(parsed["id"], str(second_event.update_id))
        self.assertEqual(payload["updateId"], second_event.update_id)
        self.assertEqual(payload["eventType"], EventType.STATUS_CHANGE)
        response.close()

    @patch("apps.bugboardapi.views.issues.open_issue_subscription")
    def test_issue_update_stream_sends_heartbeat_and_headers(self, open_subscription_mock):
        class StubSubscription:
            def get_message(self, timeout=None):
                return None

            def close(self):
                return None

        open_subscription_mock.return_value = StubSubscription()
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/issues/{self.issue.issue_id}/updates/stream",
            HTTP_ACCEPT="text/event-stream",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertEqual(response["X-Accel-Buffering"], "no")
        self.assertIn("text/event-stream", response["Content-Type"])

        chunk = next(iter(response.streaming_content))
        parsed = _parse_sse_chunk(chunk)
        self.assertEqual(parsed["event"], "ping")
        response.close()

    def test_issue_event_publish_happens_after_commit(self):
        subscription = open_issue_subscription(self.issue.issue_id)

        with transaction.atomic():
            create_issue_event(
                issue=self.issue,
                actor=self.member,
                event_type=EventType.COMMENT,
                message="Buffered comment",
            )
            self.assertIsNone(subscription.get_message(timeout=0.01))

        event = subscription.get_message(timeout=0.1)
        subscription.close()

        self.assertIsNotNone(event)
        self.assertEqual(event.event, "issue.event.created")
        self.assertEqual(event.data["message"], "Buffered comment")
        self.assertEqual(event.data["issueId"], self.issue.issue_id)
