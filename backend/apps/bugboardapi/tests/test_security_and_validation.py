from django.core.exceptions import ImproperlyConfigured
from django.conf import settings
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.bugboardapi.modules.projects.models import Project, ProjectMembership
from apps.bugboardapi.modules.tags.models import Tag
from apps.bugboardapi.modules.auth.views import LoginView, PasswordOTPRequestView, PasswordOTPVerifyView, PasswordResetView
from config.settings import MIN_SECRET_KEY_LENGTH, _validate_secret_key
from apps.bugboardapi.tests.utils import create_user_with_profile


class UserPermissionTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="member_user",
            email="member@example.com",
            password="StrongPass123!",
        )
        self.admin = create_user_with_profile(
            username="admin_user",
            email="admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )

    def test_non_admin_cannot_escalate_self_to_admin(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"isAdmin": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)

    def test_non_admin_cannot_toggle_active_flag(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_non_admin_can_update_own_safe_fields(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"firstName": "Mario", "lastName": "Rossi"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Mario")
        self.assertEqual(self.user.last_name, "Rossi")

    def test_non_admin_can_update_own_username(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"username": "member_user_renamed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "member_user_renamed")
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "member_user_renamed")

    def test_non_admin_cannot_update_email_to_existing_value(self):
        other_user = create_user_with_profile(
            username="member_other_user",
            email="member-other@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"email": other_user.email},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"][0], "Email already in use")

    def test_non_admin_cannot_update_username_to_existing_value(self):
        other_user = create_user_with_profile(
            username="member_other_username",
            email="member-other-username@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"username": other_user.username},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["username"][0], "A user with that username already exists.")

    def test_non_admin_can_update_own_email_casing(self):
        updated_email = self.user.email.upper()
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"email": updated_email},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, updated_email)

    def test_non_admin_cannot_patch_profile_img_directly(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"profileImg": "https://example.com/avatar.png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["profileImg"][0],
            "Use the dedicated upload endpoint",
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.profile_img, "")

    def test_admin_can_set_is_admin_on_other_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"isAdmin": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)

    def test_admin_can_update_other_user_username(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"username": "member_user_admin_renamed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "member_user_admin_renamed")
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "member_user_admin_renamed")

    def test_admin_cannot_update_other_user_email_to_existing_value_with_different_casing(self):
        other_user = create_user_with_profile(
            username="member_other_admin_edit",
            email="member-other-admin@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/users/{self.user.id}",
            {"email": other_user.email.upper()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"][0], "Email already in use")

    def test_admin_cannot_deactivate_self_via_patch(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/users/{self.admin.id}",
            {"active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_cannot_deactivate_self_via_status_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/users/{self.admin.id}/status",
            {"active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)


class IssueCreationValidationTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="project_admin",
            email="project_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="project_member",
            email="project_member@example.com",
            password="StrongPass123!",
        )
        self.outsider = create_user_with_profile(
            username="outsider_user",
            email="outsider@example.com",
            password="StrongPass123!",
        )

        self.project = Project.objects.create(
            name="Validation Project",
            description="Validation test project",
            color="#14B8A6",
            icon="",
            created_by=self.admin,
        )
        ProjectMembership.objects.create(project=self.project, user=self.admin)
        ProjectMembership.objects.create(project=self.project, user=self.member)
        self.tag = Tag.objects.create(name="backend")

    def test_create_issue_rejects_assignee_outside_project(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Issue invalid assignee",
            "description": "Should fail",
            "type": "BUG",
            "status": "TODO",
            "priority": "HIGH",
            "assigneeIds": [self.outsider.id],
            "tagIds": [self.tag.tag_id],
        }
        response = self.client.post(f"/api/projects/{self.project.project_id}/issues", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigneeIds", response.data)

    def test_create_issue_rejects_admin_assignee(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Issue admin assignee",
            "description": "Should fail",
            "type": "BUG",
            "status": "TODO",
            "priority": "HIGH",
            "assigneeIds": [self.admin.id],
            "tagIds": [self.tag.tag_id],
        }
        response = self.client.post(f"/api/projects/{self.project.project_id}/issues", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["assigneeIds"][0]),
            f"Admin users cannot be assigned to issues: [{self.admin.id}]",
        )

    def test_create_issue_rejects_invalid_tag_ids(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Issue invalid tag",
            "description": "Should fail",
            "type": "BUG",
            "status": "TODO",
            "priority": "HIGH",
            "assigneeIds": [self.member.id],
            "tagIds": [999999],
        }
        response = self.client.post(f"/api/projects/{self.project.project_id}/issues", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tagIds", response.data)

    def test_create_issue_with_valid_assignees_and_tags(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "title": "Issue valid",
            "description": "Should pass",
            "type": "BUG",
            "status": "TODO",
            "priority": "MEDIUM",
            "assigneeIds": [self.member.id],
            "tagIds": [self.tag.tag_id],
        }
        response = self.client.post(f"/api/projects/{self.project.project_id}/issues", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Issue valid")


class AuthThrottleConfigurationTests(SimpleTestCase):
    def test_login_view_has_scoped_throttle(self):
        self.assertIn(ScopedRateThrottle, LoginView.throttle_classes)
        self.assertEqual(LoginView.throttle_scope, "login")

    def test_otp_views_have_scoped_throttle(self):
        self.assertIn(ScopedRateThrottle, PasswordOTPRequestView.throttle_classes)
        self.assertIn(ScopedRateThrottle, PasswordOTPVerifyView.throttle_classes)
        self.assertIn(ScopedRateThrottle, PasswordResetView.throttle_classes)
        self.assertEqual(PasswordOTPRequestView.throttle_scope, "otp")
        self.assertEqual(PasswordOTPVerifyView.throttle_scope, "otp")
        self.assertEqual(PasswordResetView.throttle_scope, "otp")

    def test_rest_framework_has_required_scoped_rates(self):
        rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        self.assertIn("login", rates)
        self.assertIn("otp", rates)


class SettingsValidationTests(SimpleTestCase):
    def test_secret_key_validation_rejects_short_production_values(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            f"DJANGO_SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters in production",
        ):
            _validate_secret_key(secret_key="too-short-for-production", debug=False)

    def test_secret_key_validation_allows_short_values_only_in_debug(self):
        _validate_secret_key(secret_key="debug-short", debug=True)


class AuthCsrfTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="csrf_user",
            email="csrf@example.com",
            password="StrongPass123!",
        )

    def test_csrf_endpoint_sets_cookie(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.get("/api/auth/csrf")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("csrftoken", response.cookies)

    def test_login_requires_csrf_and_succeeds_with_token(self):
        client = APIClient(enforce_csrf_checks=True)
        blocked_response = client.post(
            "/api/auth/login",
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(blocked_response.status_code, status.HTTP_403_FORBIDDEN)

        csrf_response = client.get("/api/auth/csrf")
        csrf_token = csrf_response.cookies["csrftoken"].value
        login_response = client.post(
            "/api/auth/login",
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_otp_endpoints_require_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        otp_calls = [
            ("/api/auth/password/otp/request", {"email": self.user.email}),
            ("/api/auth/password/otp/verify", {"email": self.user.email, "code": "123456"}),
            (
                "/api/auth/password/reset",
                {"email": self.user.email, "code": "123456", "newPassword": "NewStrongPass123!"},
            ),
        ]

        for path, payload in otp_calls:
            response = client.post(path, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class JwtAuthFlowTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="jwt_user",
            email="jwt@example.com",
            password="StrongPass123!",
        )

    def _auth_headers(self, access_token: str) -> dict[str, str]:
        return {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}

    def test_login_me_refresh_logout_flow(self):
        login_response = self.client.post(
            "/api/auth/login",
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("accessToken", login_response.data)
        self.assertIn("user", login_response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, login_response.cookies)

        access_token = login_response.data["accessToken"]

        me_response = self.client.get("/api/auth/me", **self._auth_headers(access_token))
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["email"], self.user.email)

        refresh_response = self.client.post("/api/auth/refresh", {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("accessToken", refresh_response.data)

        refresh_cookie = login_response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value

        logout_response = self.client.post(
            "/api/auth/logout",
            {},
            format="json",
            **self._auth_headers(refresh_response.data["accessToken"]),
        )
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)

        me_after_logout = self.client.get("/api/auth/me", **self._auth_headers(access_token))
        self.assertIn(me_after_logout.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

        stale_refresh_client = self.client_class()
        stale_refresh_client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = refresh_cookie
        stale_refresh = stale_refresh_client.post("/api/auth/refresh", {}, format="json")
        self.assertEqual(stale_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_private_endpoints_require_authentication(self):
        protected_calls = [
            ("get", "/api/auth/me"),
            ("get", "/api/projects"),
            ("get", "/api/notifications"),
            ("get", "/api/projects/999/issues"),
            ("get", "/api/issues/999"),
        ]

        for method, path in protected_calls:
            response = getattr(self.client, method)(path, {}, format="json")
            self.assertIn(
                response.status_code,
                (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                msg=f"{method.upper()} {path} should require auth",
            )

    def test_refresh_requires_cookie(self):
        response = self.client.post("/api/auth/refresh", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
