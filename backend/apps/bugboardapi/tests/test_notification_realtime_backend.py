from rest_framework import status
from rest_framework.test import APITestCase

from apps.bugboardapi.modules.issues.models import Issue, IssueStatus
from apps.bugboardapi.modules.notifications.models import NotifyType, NotifyUser
from apps.bugboardapi.modules.notifications.realtime import open_notification_subscription
from apps.bugboardapi.modules.notifications.services import (
    notify_issue_assigned,
    notify_issue_closed,
    notify_issue_updated,
)
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


class NotificationRealtimeBackendTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="realtime_admin",
            email="realtime_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="realtime_member",
            email="realtime_member@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Realtime Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Realtime backend issue",
            description="desc",
            issue_type="BUG",
            status=IssueStatus.TODO,
            priority="HIGH",
        )
        self.client.force_authenticate(user=self.member)

    def test_issue_notification_publishes_only_after_commit(self):
        subscription = open_notification_subscription(self.member.id)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            notify_issue_updated(users=[self.member], issue=self.issue)
            self.assertIsNone(subscription.get_message(timeout=0.01))

        self.assertEqual(len(callbacks), 1)
        self.assertIsNone(subscription.get_message(timeout=0.01))
        callbacks[0]()

        event = subscription.get_message(timeout=0.1)
        subscription.close()

        self.assertIsNotNone(event)
        self.assertEqual(event.event, "notification.created")
        self.assertEqual(event.data["type"], NotifyType.ISSUE_UPDATED)
        self.assertEqual(event.data["issueId"], self.issue.issue_id)

    def test_issue_notification_fans_out_to_multiple_memory_subscribers(self):
        first_subscription = open_notification_subscription(self.member.id)
        second_subscription = open_notification_subscription(self.member.id)

        with self.captureOnCommitCallbacks(execute=True):
            notify_issue_updated(users=[self.member], issue=self.issue)

        first_event = first_subscription.get_message(timeout=0.1)
        second_event = second_subscription.get_message(timeout=0.1)
        first_subscription.close()
        second_subscription.close()

        self.assertIsNotNone(first_event)
        self.assertIsNotNone(second_event)
        self.assertEqual(first_event.event, "notification.created")
        self.assertEqual(second_event.event, "notification.created")
        self.assertEqual(first_event.data["notifyUserId"], second_event.data["notifyUserId"])
        self.assertEqual(first_event.data["issueId"], self.issue.issue_id)
        self.assertEqual(second_event.data["issueId"], self.issue.issue_id)

    def test_notifications_list_returns_paginated_payload(self):
        notify_issue_updated(users=[self.member], issue=self.issue)

        first_response = self.client.get("/api/notifications")
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first_response.data["results"]), 1)
        self.assertEqual(first_response.data["results"][0]["type"], NotifyType.ISSUE_UPDATED)
        self.assertIsNone(first_response.data["nextCursor"])
        self.assertFalse(first_response.data["hasMore"])
        self.assertTrue(first_response.data["hasUnread"])

    def test_notifications_list_supports_cursor_pagination(self):
        first_notification = notify_issue_updated(users=[self.member], issue=self.issue)
        second_notification = notify_issue_closed(users=[self.member], issue=self.issue)
        third_notification = notify_issue_assigned(users=[self.member], issue=self.issue)

        first_notify_user = NotifyUser.objects.get(notification=first_notification, user=self.member)
        second_notify_user = NotifyUser.objects.get(notification=second_notification, user=self.member)
        third_notify_user = NotifyUser.objects.get(notification=third_notification, user=self.member)

        first_page = self.client.get("/api/notifications?limit=2")
        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["notifyUserId"] for item in first_page.data["results"]],
            [third_notify_user.notify_user_id, second_notify_user.notify_user_id],
        )
        self.assertTrue(first_page.data["hasMore"])
        self.assertEqual(first_page.data["nextCursor"], second_notify_user.notify_user_id)
        self.assertTrue(first_page.data["hasUnread"])

        second_page = self.client.get(f"/api/notifications?limit=2&before={first_page.data['nextCursor']}")
        self.assertEqual(second_page.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["notifyUserId"] for item in second_page.data["results"]],
            [first_notify_user.notify_user_id],
        )
        self.assertFalse(second_page.data["hasMore"])
        self.assertIsNone(second_page.data["nextCursor"])
        self.assertTrue(second_page.data["hasUnread"])

    def test_read_updates_notification_in_paginated_list(self):
        notification = notify_issue_updated(users=[self.member], issue=self.issue)
        notify_user = NotifyUser.objects.get(notification=notification, user=self.member)

        self.client.get("/api/notifications")
        read_response = self.client.post(f"/api/notifications/{notify_user.notify_user_id}/read", {}, format="json")
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        list_response = self.client.get("/api/notifications")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(list_response.data["results"][0]["isRead"])
        self.assertIsNotNone(list_response.data["results"][0]["readAt"])
        self.assertFalse(list_response.data["hasUnread"])

    def test_delete_updates_paginated_notification_list(self):
        first_notification = notify_issue_updated(users=[self.member], issue=self.issue)
        second_notification = notify_issue_closed(users=[self.member], issue=self.issue)
        first_notify_user = NotifyUser.objects.get(notification=first_notification, user=self.member)
        second_notify_user = NotifyUser.objects.get(notification=second_notification, user=self.member)

        self.client.get("/api/notifications")
        delete_response = self.client.delete(f"/api/notifications/{second_notify_user.notify_user_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        list_response = self.client.get("/api/notifications")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["notifyUserId"] for item in list_response.data["results"]],
            [first_notify_user.notify_user_id],
        )
        self.assertTrue(list_response.data["hasUnread"])

    def test_delete_keeps_notification_row_when_other_recipients_still_exist(self):
        shared_notification = notify_issue_updated(users=[self.admin, self.member], issue=self.issue)
        member_notify_user = NotifyUser.objects.get(notification=shared_notification, user=self.member)
        self.assertTrue(
            NotifyUser.objects.filter(notification=shared_notification, user=self.admin).exists()
        )

        delete_response = self.client.delete(f"/api/notifications/{member_notify_user.notify_user_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            NotifyUser.objects.filter(notification=shared_notification, user=self.admin).exists()
        )
        self.assertTrue(
            NotifyUser.objects.filter(notification=shared_notification).exists()
        )
