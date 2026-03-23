from django.test import TestCase
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APITestCase


class ApiPhase1RoutingTests(TestCase):
    def test_project_issue_route_uses_project_id_camel_case_kwarg(self):
        match = resolve("/api/projects/42/issues")
        self.assertEqual(match.kwargs["projectId"], 42)

    def test_issue_route_uses_issue_id_camel_case_kwarg(self):
        match = resolve("/api/issues/42")
        self.assertEqual(match.kwargs["issueId"], "42")

    def test_notification_route_uses_notification_id_camel_case_kwarg(self):
        match = resolve("/api/notifications/42")
        self.assertEqual(match.kwargs["notificationId"], 42)

    def test_issue_event_attachment_route_uses_event_id_camel_case_kwarg(self):
        match = resolve("/api/issues/7/events/42/attachments")
        self.assertEqual(match.kwargs["issueId"], 7)
        self.assertEqual(match.kwargs["eventId"], 42)


class ApiPhase1CleanupTests(APITestCase):
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

    def test_openapi_endpoints_are_published(self):
        schema_response = self.client.get("/api/schema")
        docs_response = self.client.get("/api/docs")
        redoc_response = self.client.get("/api/redoc")

        self.assertEqual(schema_response.status_code, status.HTTP_200_OK)
        self.assertEqual(docs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(redoc_response.status_code, status.HTTP_200_OK)
