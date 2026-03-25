from django.test import TestCase
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bugboardapi.tests.utils import create_user_with_profile


class ApiPhase1RoutingTests(TestCase):
    def test_project_issue_route_uses_project_id_camel_case_kwarg(self):
        match = resolve("/api/projects/42/issues")
        self.assertEqual(match.kwargs["projectId"], 42)

    def test_issue_route_uses_issue_id_camel_case_kwarg(self):
        match = resolve("/api/issues/42")
        self.assertEqual(match.kwargs["issueId"], "42")

class ApiPhase1CleanupTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_profile(
            username="cleanup_user",
            email="cleanup_user@example.com",
            password="StrongPass123!",
            is_admin=True,
        )

    def test_removed_legacy_routes_return_not_found(self):
        for path in (
            "/api",
            "/api/auth/login",
            "/api/auth/me",
            "/api/auth/refresh",
            "/api/auth/logout",
            "/api/users/1/status",
            "/api/users/me/upload_profile_image",
            "/api/issues/1/details",
            "/api/users.json",
            "/api/issues/1.json",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_frontend_unused_endpoints_are_no_longer_exposed(self):
        cases = (
            ("get", "/api/tags", status.HTTP_404_NOT_FOUND),
            ("post", "/api/issues/1/attachments", status.HTTP_404_NOT_FOUND),
            ("post", "/api/issues/1/events/1/attachments", status.HTTP_404_NOT_FOUND),
            ("get", "/api/users/1", status.HTTP_405_METHOD_NOT_ALLOWED),
            ("put", "/api/users/1", status.HTTP_405_METHOD_NOT_ALLOWED),
            ("get", "/api/notifications/1", status.HTTP_405_METHOD_NOT_ALLOWED),
            ("patch", "/api/notifications", status.HTTP_405_METHOD_NOT_ALLOWED),
            ("put", "/api/projects/1", status.HTTP_405_METHOD_NOT_ALLOWED),
            ("put", "/api/issues/1", status.HTTP_405_METHOD_NOT_ALLOWED),
            ("delete", "/api/issues/1", status.HTTP_405_METHOD_NOT_ALLOWED),
        )

        for method, path, expected_status in cases:
            with self.subTest(method=method, path=path):
                self.client.force_authenticate(user=self.user)
                response = getattr(self.client, method)(path)
                self.assertEqual(response.status_code, expected_status)

    def test_openapi_endpoints_are_published(self):
        schema_response = self.client.get("/api/schema")
        docs_response = self.client.get("/api/docs")
        redoc_response = self.client.get("/api/redoc")

        self.assertEqual(schema_response.status_code, status.HTTP_200_OK)
        self.assertEqual(docs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(redoc_response.status_code, status.HTTP_200_OK)
