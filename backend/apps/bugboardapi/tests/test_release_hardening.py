from unittest.mock import patch

from django.conf import settings
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bugboardapi.modules.issues.models import Issue, IssueStatus
from apps.bugboardapi.modules.notifications.models import NotifyType, NotifyUser
from apps.bugboardapi.modules.projects.models import ProjectMembership
from apps.bugboardapi.modules.projects.serializers import ProjectSerializer
from apps.bugboardapi.modules.projects.services import project_service
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


class UserListQueryParamTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="query_admin",
            email="query_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member_one = create_user_with_profile(
            username="query_member_one",
            email="query_member_one@example.com",
            password="StrongPass123!",
        )
        self.member_two = create_user_with_profile(
            username="query_member_two",
            email="query_member_two@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_user_list_filters_by_user_ids(self):
        response = self.client.get(
            f"/api/users?userIds={self.member_one.id},{self.member_two.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["userId"] for item in response.data["results"]}
        self.assertEqual(returned_ids, {self.member_one.id, self.member_two.id})

    def test_admin_user_list_excludes_requested_user_ids(self):
        response = self.client.get(f"/api/users?excludeUserIds={self.member_two.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["userId"] for item in response.data["results"]}
        self.assertNotIn(self.member_two.id, returned_ids)
        self.assertIn(self.member_one.id, returned_ids)

    def test_admin_user_list_rejects_invalid_user_ids_query_param(self):
        response = self.client.get("/api/users?userIds=abc")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userIds", response.data)

    def test_user_patch_requires_boolean_active_payload(self):
        response = self.client.patch(
            f"/api/users/{self.member_one.id}",
            {"active": "false"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("active", response.data)


class ProjectViewRegressionTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="project_reg_admin",
            email="project_reg_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="project_reg_member",
            email="project_reg_member@example.com",
            password="StrongPass123!",
        )
        self.other_member = create_user_with_profile(
            username="project_reg_other",
            email="project_reg_other@example.com",
            password="StrongPass123!",
        )
        self.alpha_project = create_project_with_members(
            created_by=self.admin,
            name="Alpha Board",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.beta_project = create_project_with_members(
            created_by=self.admin,
            name="Beta Desk",
            admin_members=[self.admin],
            developer_members=[self.other_member],
        )
        self.client.force_authenticate(user=self.admin)

    def test_project_list_q_filter_returns_only_matching_projects(self):
        response = self.client.get("/api/projects?q=Alpha")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_names = {item["name"] for item in response.data}
        self.assertEqual(returned_names, {"Alpha Board"})

    @patch("apps.bugboardapi.modules.projects.services.notify_project_removed")
    def test_project_delete_notifies_members_before_deletion(self, mock_notify_project_removed):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/projects/{self.alpha_project.project_id}")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        mock_notify_project_removed.assert_called_once()
        self.assertIsNone(mock_notify_project_removed.call_args.kwargs["project"])
        notified_user_ids = {
            user.id for user in mock_notify_project_removed.call_args.kwargs["users"]
        }
        self.assertEqual(notified_user_ids, {self.admin.id, self.member.id})

    @patch("apps.bugboardapi.modules.projects.services.notify_project_removed")
    def test_project_delete_skips_inactive_members_in_notifications(self, mock_notify_project_removed):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/projects/{self.alpha_project.project_id}")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        mock_notify_project_removed.assert_called_once()

        notified_user_ids = {
            user.id for user in mock_notify_project_removed.call_args.kwargs["users"]
        }
        self.assertEqual(notified_user_ids, {self.admin.id})

    def test_project_create_rejects_invalid_team_payload(self):
        response = self.client.post(
            "/api/projects",
            {
                "name": "Gamma Team",
                "description": "desc",
                "color": "#14B8A6",
                "icon": "folder",
                "team": ["oops"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userIds", response.data)

    def test_project_patch_rejects_invalid_user_ids_payload(self):
        response = self.client.patch(
            f"/api/projects/{self.beta_project.project_id}",
            {"userIds": ["oops"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userIds", response.data)


class AuthSessionCookieTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="cookie_user",
            email="cookie_user@example.com",
            password="StrongPass123!",
        )

    @override_settings(
        AUTH_REFRESH_COOKIE_SECURE=True,
        AUTH_REFRESH_COOKIE_SAMESITE="Strict",
        AUTH_REFRESH_COOKIE_PATH="/api/sessions/current",
    )
    def test_login_sets_refresh_cookie_flags_and_path(self):
        response = self.client.post(
            "/api/sessions",
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        refresh_cookie = response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]
        self.assertEqual(refresh_cookie["path"], "/api/sessions/current")
        self.assertEqual(refresh_cookie["samesite"], "Strict")
        self.assertTrue(refresh_cookie["secure"])
        self.assertTrue(refresh_cookie["httponly"])

    def test_refresh_rejects_invalid_refresh_cookie(self):
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = "invalid.refresh.token"
        response = self.client.post("/api/sessions/current/access-token", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "Invalid refresh token")

    def test_logout_with_invalid_refresh_cookie_returns_success_and_clears_cookie(self):
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = "invalid.refresh.token"
        response = self.client.delete("/api/sessions/current", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)
        cleared_cookie = response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]
        self.assertEqual(cleared_cookie["path"], settings.AUTH_REFRESH_COOKIE_PATH)


class ProjectTransactionalSafetyNetTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="txn_project_admin",
            email="txn_project_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="txn_project_member",
            email="txn_project_member@example.com",
            password="StrongPass123!",
        )
        self.other_member = create_user_with_profile(
            username="txn_project_other",
            email="txn_project_other@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Transactional Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )

    def test_create_project_rolls_back_when_notification_dispatch_fails(self):
        serializer = ProjectSerializer(
            data={
                "name": "Created project",
                "description": "desc",
                "color": "#14B8A6",
                "icon": "folder",
            }
        )
        serializer.is_valid(raise_exception=True)

        with patch(
            "apps.bugboardapi.modules.projects.services.notify_project_assigned",
            side_effect=RuntimeError("project add notification failed"),
        ):
            with self.assertRaisesMessage(RuntimeError, "project add notification failed"):
                project_service.create_project_with_team(
                    serializer=serializer,
                    creator=self.admin,
                    raw_user_ids=[self.member.id],
                )

        self.assertFalse(
            ProjectMembership.objects.filter(project__name="Created project").exists()
        )

    def test_update_project_rolls_back_when_unassign_notification_fails(self):
        serializer = ProjectSerializer(
            self.project,
            data={"name": "Updated project"},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        with patch(
            "apps.bugboardapi.modules.projects.services.notify_project_unassigned",
            side_effect=RuntimeError("project unassign notification failed"),
        ):
            with self.assertRaisesMessage(RuntimeError, "project unassign notification failed"):
                project_service.update_project_with_team(
                    serializer=serializer,
                    project=self.project,
                    raw_user_ids=[],
                    has_team_payload=True,
                    actor=self.admin,
                )

        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "Transactional Project")
        self.assertTrue(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.member,
            ).exists()
        )

    def test_project_removed_notification_survives_project_deletion(self):
        with self.captureOnCommitCallbacks(execute=True):
            project_service.delete_project_and_notify(project=self.project)

        self.assertFalse(
            ProjectMembership.objects.filter(project_id=self.project.project_id).exists()
        )
        self.assertTrue(
            NotifyUser.objects.filter(
                user=self.member,
                notification__notify_type=NotifyType.PROJECT_REMOVED,
            ).exists()
        )
