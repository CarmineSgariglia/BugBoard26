from unittest.mock import patch

from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bugboardapi.models import Issue, IssueStatus, NotifyType, NotifyUser
from apps.bugboardapi.services.notification_realtime import open_notification_subscription
from apps.bugboardapi.services.notifications import notify_users
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


class NotificationRealtimeBackendTests(APITestCase):
    def setUp(self):
        cache.clear()
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

    def test_notify_users_publishes_only_after_commit(self):
        subscription = open_notification_subscription(self.member.id)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            notify_users(
                notify_type=NotifyType.ISSUE_UPDATED,
                users=[self.member],
                issue=self.issue,
            )
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

    def test_notifications_list_uses_cache_after_hydration(self):
        notify_users(
            notify_type=NotifyType.ISSUE_UPDATED,
            users=[self.member],
            issue=self.issue,
        )

        first_response = self.client.get("/api/notifications")
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first_response.data), 1)

        with patch(
            "apps.bugboardapi.views.notifications.NotificationViewSet._load_notifications_from_db",
            side_effect=AssertionError("DB should not be hit when cache is warm"),
        ):
            second_response = self.client.get("/api/notifications")

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data, first_response.data)

    def test_notify_users_prepends_new_notification_into_cached_list(self):
        first_notification = notify_users(
            notify_type=NotifyType.ISSUE_UPDATED,
            users=[self.member],
            issue=self.issue,
        )
        first_notify_user = NotifyUser.objects.get(notification=first_notification, user=self.member)

        first_response = self.client.get("/api/notifications")
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(first_response.data[0]["notifyUserId"], first_notify_user.notify_user_id)

        with self.captureOnCommitCallbacks(execute=True):
            second_notification = notify_users(
                notify_type=NotifyType.ISSUE_CLOSED,
                users=[self.member],
                issue=self.issue,
            )
        second_notify_user = NotifyUser.objects.get(notification=second_notification, user=self.member)

        with patch(
            "apps.bugboardapi.views.notifications.NotificationViewSet._load_notifications_from_db",
            side_effect=AssertionError("DB should not be hit when cache is updated on create"),
        ):
            second_response = self.client.get("/api/notifications")

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data[0]["notifyUserId"], second_notify_user.notify_user_id)
        self.assertEqual(second_response.data[1]["notifyUserId"], first_notify_user.notify_user_id)

    def test_read_updates_cached_notification(self):
        notification = notify_users(
            notify_type=NotifyType.ISSUE_UPDATED,
            users=[self.member],
            issue=self.issue,
        )
        notify_user = NotifyUser.objects.get(notification=notification, user=self.member)

        self.client.get("/api/notifications")
        read_response = self.client.post(f"/api/notifications/{notify_user.notify_user_id}/read", {}, format="json")
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)

        with patch(
            "apps.bugboardapi.views.notifications.NotificationViewSet._load_notifications_from_db",
            side_effect=AssertionError("DB should not be hit when cache is updated on read"),
        ):
            list_response = self.client.get("/api/notifications")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(list_response.data[0]["isRead"])
        self.assertIsNotNone(list_response.data[0]["readAt"])

    def test_delete_updates_cached_notification_list(self):
        first_notification = notify_users(
            notify_type=NotifyType.ISSUE_UPDATED,
            users=[self.member],
            issue=self.issue,
        )
        second_notification = notify_users(
            notify_type=NotifyType.ISSUE_CLOSED,
            users=[self.member],
            issue=self.issue,
        )
        first_notify_user = NotifyUser.objects.get(notification=first_notification, user=self.member)
        second_notify_user = NotifyUser.objects.get(notification=second_notification, user=self.member)

        self.client.get("/api/notifications")
        delete_response = self.client.delete(f"/api/notifications/{second_notify_user.notify_user_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        with patch(
            "apps.bugboardapi.views.notifications.NotificationViewSet._load_notifications_from_db",
            side_effect=AssertionError("DB should not be hit when cache is updated on delete"),
        ):
            list_response = self.client.get("/api/notifications")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["notifyUserId"] for item in list_response.data], [first_notify_user.notify_user_id])
