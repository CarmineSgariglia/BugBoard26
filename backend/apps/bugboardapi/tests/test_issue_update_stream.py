import json
from types import SimpleNamespace
from unittest.mock import patch

from django.db import transaction
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITransactionTestCase

from apps.bugboardapi.common.sse import build_sse_response, parse_last_event_id, stream_sse_events
from apps.bugboardapi.modules.issues.activity import create_issue_event
from apps.bugboardapi.modules.issues.models import EventType, Issue, IssueStatus
from apps.bugboardapi.modules.issues.realtime import open_issue_subscription
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


class _StubStreamEvent:
    def __init__(self, *, event: str, event_id: int, data: dict):
        self.event = event
        self.event_id = event_id
        self.data = data


class _StubSubscription:
    def __init__(self, events):
        self._events = list(events)
        self.closed = False

    def get_message(self, timeout=None):
        if not self._events:
            return None
        return self._events.pop(0)

    def close(self):
        self.closed = True


class TestSharedSSEHelpers(SimpleTestCase):
    def test_parse_last_event_id_defaults_to_zero_when_header_is_missing(self):
        request = SimpleNamespace(headers={})
        self.assertEqual(parse_last_event_id(request), 0)

    def test_parse_last_event_id_ignores_invalid_values(self):
        request = SimpleNamespace(headers={"Last-Event-ID": "not-a-number"})
        self.assertEqual(parse_last_event_id(request), 0)

    def test_stream_sse_events_replays_catchup_items(self):
        subscription = _StubSubscription([])
        generator = stream_sse_events(
            catchup_items=[{"id": 3, "message": "catchup"}],
            serialize_catchup_item=lambda item: ("issue.event.created", item, item["id"]),
            subscription=subscription,
            last_seen_id=0,
            heartbeat_interval=0.01,
        )

        chunk = next(generator)
        parsed = _parse_sse_chunk(chunk)

        self.assertEqual(parsed["event"], "issue.event.created")
        self.assertEqual(parsed["id"], "3")
        self.assertEqual(json.loads(parsed["data"])["message"], "catchup")
        generator.close()
        self.assertTrue(subscription.closed)

    def test_stream_sse_events_sends_heartbeat_when_subscription_is_idle(self):
        subscription = _StubSubscription([])
        generator = stream_sse_events(
            catchup_items=[],
            serialize_catchup_item=lambda item: ("unused", item, 0),
            subscription=subscription,
            last_seen_id=0,
            heartbeat_interval=0.01,
        )

        chunk = next(generator)
        parsed = _parse_sse_chunk(chunk)

        self.assertEqual(parsed["event"], "ping")
        generator.close()

    def test_stream_sse_events_skips_old_live_events(self):
        subscription = _StubSubscription(
            [
                _StubStreamEvent(event="issue.event.created", event_id=2, data={"message": "old"}),
                _StubStreamEvent(event="issue.event.created", event_id=4, data={"message": "fresh"}),
            ]
        )
        generator = stream_sse_events(
            catchup_items=[],
            serialize_catchup_item=lambda item: ("unused", item, 0),
            subscription=subscription,
            last_seen_id=3,
            heartbeat_interval=0.01,
        )

        chunk = next(generator)
        parsed = _parse_sse_chunk(chunk)

        self.assertEqual(parsed["id"], "4")
        self.assertEqual(json.loads(parsed["data"])["message"], "fresh")
        generator.close()

    def test_stream_sse_events_closes_subscription_on_generator_exit(self):
        subscription = _StubSubscription([])
        disconnects: list[str] = []
        generator = stream_sse_events(
            catchup_items=[],
            serialize_catchup_item=lambda item: ("unused", item, 0),
            subscription=subscription,
            last_seen_id=0,
            heartbeat_interval=0.01,
            on_disconnect=lambda: disconnects.append("called"),
        )

        next(generator)
        generator.close()

        self.assertTrue(subscription.closed)
        self.assertEqual(disconnects, ["called"])

    def test_build_sse_response_sets_expected_headers(self):
        response = build_sse_response(iter(["event: ping\ndata: {}\n\n"]))

        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertEqual(response["X-Accel-Buffering"], "no")
        self.assertIn("text/event-stream", response["Content-Type"])


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

    def test_issue_update_stream_ignores_invalid_last_event_id(self):
        issue_event = create_issue_event(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="Visible comment",
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/issues/{self.issue.issue_id}/updates/stream",
            HTTP_ACCEPT="text/event-stream",
            HTTP_LAST_EVENT_ID="not-a-number",
        )

        chunk = next(iter(response.streaming_content))
        parsed = _parse_sse_chunk(chunk)
        self.assertEqual(parsed["id"], str(issue_event.update_id))
        response.close()

    @patch("apps.bugboardapi.modules.issues.views.open_issue_subscription")
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

    @patch("apps.bugboardapi.modules.issues.views.open_issue_subscription", side_effect=RuntimeError)
    def test_issue_update_stream_returns_service_unavailable_when_backend_fails(self, _mock_subscription):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/issues/{self.issue.issue_id}/updates/stream",
            HTTP_ACCEPT="text/event-stream",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

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

    def test_issue_event_fans_out_to_multiple_memory_subscribers(self):
        first_subscription = open_issue_subscription(self.issue.issue_id)
        second_subscription = open_issue_subscription(self.issue.issue_id)

        create_issue_event(
            issue=self.issue,
            actor=self.member,
            event_type=EventType.COMMENT,
            message="Broadcast comment",
        )

        first_event = first_subscription.get_message(timeout=0.1)
        second_event = second_subscription.get_message(timeout=0.1)
        first_subscription.close()
        second_subscription.close()

        self.assertIsNotNone(first_event)
        self.assertIsNotNone(second_event)
        self.assertEqual(first_event.event, "issue.event.created")
        self.assertEqual(second_event.event, "issue.event.created")
        self.assertEqual(first_event.data["updateId"], second_event.data["updateId"])
        self.assertEqual(first_event.data["message"], "Broadcast comment")
        self.assertEqual(second_event.data["message"], "Broadcast comment")
