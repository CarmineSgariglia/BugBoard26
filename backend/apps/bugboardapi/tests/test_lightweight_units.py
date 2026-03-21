from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.test import APITestCase

from apps.bugboardapi.security.authentication import RevocableJWTAuthentication
from apps.bugboardapi.modules.issues.rules import validate_project_assignee_ids
from apps.bugboardapi.modules.tags.models import Tag
from apps.bugboardapi.modules.tags.services import resolve_tag_ids, validate_existing_tag_ids
from apps.bugboardapi.modules.users.serializers import UserMutationSerializer
from apps.bugboardapi.roles import DEVELOPER_GROUP_NAME
from apps.bugboardapi.tests.utils import create_user_with_profile


def _detail_text(detail):
    if isinstance(detail, (list, tuple)):
        return str(detail[0])
    return str(detail)


class ValidateProjectAssigneeIdsTests(SimpleTestCase):
    def test_returns_early_when_assignee_ids_is_none(self):
        with patch("apps.bugboardapi.modules.issues.rules.classify_project_assignment_user_ids") as classify_user_ids:
            validate_project_assignee_ids(project=object(), assignee_ids=None)
            classify_user_ids.assert_not_called()

    def test_returns_early_when_assignee_ids_is_empty(self):
        with patch("apps.bugboardapi.modules.issues.rules.classify_project_assignment_user_ids") as classify_user_ids:
            validate_project_assignee_ids(project=object(), assignee_ids=[])
            classify_user_ids.assert_not_called()

    def test_raises_when_ids_are_not_project_members(self):
        with patch(
            "apps.bugboardapi.modules.issues.rules.classify_project_assignment_user_ids",
            return_value=([99], [], []),
        ):
            with self.assertRaises(ValidationError) as ctx:
                validate_project_assignee_ids(project=object(), assignee_ids=[10, 99])

        self.assertEqual(
            _detail_text(ctx.exception.detail["assigneeIds"]),
            "Users must be members of project: [99]",
        )

    def test_raises_when_assignee_is_admin(self):
        with patch(
            "apps.bugboardapi.modules.issues.rules.classify_project_assignment_user_ids",
            return_value=([], [10], []),
        ):
            with self.assertRaises(ValidationError) as ctx:
                validate_project_assignee_ids(project=object(), assignee_ids=[10])

        self.assertEqual(
            _detail_text(ctx.exception.detail["assigneeIds"]),
            "Admin users cannot be assigned to issues: [10]",
        )

    def test_accepts_non_admin_project_members(self):
        with patch(
            "apps.bugboardapi.modules.issues.rules.classify_project_assignment_user_ids",
            return_value=([], [], []),
        ):
            validate_project_assignee_ids(project=object(), assignee_ids=[10])


class RevocableJWTAuthenticationTests(SimpleTestCase):
    def test_returns_none_when_base_authentication_returns_none(self):
        request = object()

        with patch(
            "rest_framework_simplejwt.authentication.JWTAuthentication.authenticate",
            return_value=None,
        ):
            self.assertIsNone(RevocableJWTAuthentication().authenticate(request))

    def test_returns_auth_tuple_when_token_has_no_sid(self):
        request = object()
        user = SimpleNamespace()
        token = {}

        with patch(
            "rest_framework_simplejwt.authentication.JWTAuthentication.authenticate",
            return_value=(user, token),
        ):
            self.assertEqual(RevocableJWTAuthentication().authenticate(request), (user, token))

    def test_raises_when_sid_is_revoked(self):
        request = object()
        user = SimpleNamespace()
        token = {"sid": "revoked"}

        with (
            patch(
                "rest_framework_simplejwt.authentication.JWTAuthentication.authenticate",
                return_value=(user, token),
            ),
            patch("apps.bugboardapi.security.authentication.is_token_session_revoked", return_value=True),
        ):
            with self.assertRaises(AuthenticationFailed):
                RevocableJWTAuthentication().authenticate(request)

    def test_returns_auth_tuple_when_sid_is_not_revoked(self):
        request = object()
        user = SimpleNamespace()
        token = {"sid": "active"}

        with (
            patch(
                "rest_framework_simplejwt.authentication.JWTAuthentication.authenticate",
                return_value=(user, token),
            ),
            patch("apps.bugboardapi.security.authentication.is_token_session_revoked", return_value=False),
        ):
            self.assertEqual(RevocableJWTAuthentication().authenticate(request), (user, token))


class UserMutationSerializerContractsTests(TestCase):
    @patch("apps.bugboardapi.modules.users.serializers.ensure_valid_password")
    def test_defaults_new_user_group_to_developer(self, mock_ensure_valid_password):
        serializer = UserMutationSerializer(
            data={
                "username": "serializer_default_role",
                "email": "serializer_default_role@example.com",
                "password": "StrongPass123!",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["group"], DEVELOPER_GROUP_NAME)
        mock_ensure_valid_password.assert_called_once()

    @patch("apps.bugboardapi.modules.users.serializers.ensure_valid_password")
    def test_new_user_password_is_optional(self, mock_ensure_valid_password):
        serializer = UserMutationSerializer(
            data={
                "username": "serializer_optional_password",
                "email": "serializer_optional_password@example.com",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["group"], DEVELOPER_GROUP_NAME)
        mock_ensure_valid_password.assert_not_called()

    def test_rejects_mismatched_group_and_is_admin_alias(self):
        serializer = UserMutationSerializer(
            data={
                "username": "serializer_role_mismatch",
                "email": "serializer_role_mismatch@example.com",
                "password": "StrongPass123!",
                "group": DEVELOPER_GROUP_NAME,
                "isAdmin": True,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            serializer.errors["group"][0],
            "group and isAdmin must describe the same role",
        )

    def test_existing_user_password_updates_are_rejected(self):
        user = create_user_with_profile(
            username="serializer_existing_user",
            email="serializer_existing_user@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        serializer = UserMutationSerializer(
            instance=user,
            data={"password": "AnotherStrongPass123!"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            serializer.errors["password"][0],
            "Use the dedicated password endpoint",
        )


class TagServicesContractsTests(TestCase):
    def test_validate_existing_tag_ids_rejects_missing_ids(self):
        existing_tag = Tag.objects.create(name="frontend")

        with self.assertRaises(ValidationError) as ctx:
            validate_existing_tag_ids([existing_tag.tag_id, 999999])

        self.assertEqual(
            _detail_text(ctx.exception.detail["tagIds"]),
            "Invalid tag ids: [999999]",
        )

    def test_resolve_tag_ids_reuses_existing_tags_and_creates_missing_names(self):
        existing_tag = Tag.objects.create(name="api")

        resolved_tag_ids = resolve_tag_ids(
            tag_ids=[existing_tag.tag_id, existing_tag.tag_id],
            tag_names=[" API ", "frontend", "Frontend"],
        )

        self.assertEqual(
            [Tag.objects.get(tag_id=tag_id).name for tag_id in resolved_tag_ids],
            ["Api", "Frontend"],
        )
        self.assertEqual(Tag.objects.filter(name__iexact="api").count(), 1)
        self.assertEqual(Tag.objects.filter(name__iexact="frontend").count(), 1)


class HealthEndpointContractsTests(APITestCase):
    def test_health_endpoint_remains_public_and_stable(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"status": "ok"})
