from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.bugboardapi.authentication import RevocableJWTAuthentication
from apps.bugboardapi.issue_rules import validate_project_assignee_ids


def _detail_text(detail):
    if isinstance(detail, (list, tuple)):
        return str(detail[0])
    return str(detail)


class ValidateProjectAssigneeIdsTests(SimpleTestCase):
    def test_returns_early_when_assignee_ids_is_none(self):
        with patch("apps.bugboardapi.issue_rules.ProjectMembership") as membership_model:
            validate_project_assignee_ids(project=object(), assignee_ids=None)
            membership_model.objects.filter.assert_not_called()

    def test_returns_early_when_assignee_ids_is_empty(self):
        with patch("apps.bugboardapi.issue_rules.ProjectMembership") as membership_model:
            validate_project_assignee_ids(project=object(), assignee_ids=[])
            membership_model.objects.filter.assert_not_called()

    def test_raises_when_ids_are_not_project_members(self):
        membership = SimpleNamespace(user_id=10, user=SimpleNamespace())
        queryset = MagicMock()
        queryset.select_related.return_value = [membership]

        with (
            patch("apps.bugboardapi.issue_rules.ProjectMembership") as membership_model,
            patch("apps.bugboardapi.issue_rules.is_admin_user", return_value=False),
        ):
            membership_model.objects.filter.return_value = queryset

            with self.assertRaises(ValidationError) as ctx:
                validate_project_assignee_ids(project=object(), assignee_ids=[10, 99])

        self.assertEqual(
            _detail_text(ctx.exception.detail["assigneeIds"]),
            "Users must be members of project: [99]",
        )

    def test_raises_when_assignee_is_admin(self):
        membership = SimpleNamespace(user_id=10, user=SimpleNamespace())
        queryset = MagicMock()
        queryset.select_related.return_value = [membership]

        with (
            patch("apps.bugboardapi.issue_rules.ProjectMembership") as membership_model,
            patch("apps.bugboardapi.issue_rules.is_admin_user", return_value=True),
        ):
            membership_model.objects.filter.return_value = queryset

            with self.assertRaises(ValidationError) as ctx:
                validate_project_assignee_ids(project=object(), assignee_ids=[10])

        self.assertEqual(
            _detail_text(ctx.exception.detail["assigneeIds"]),
            "Admin users cannot be assigned to issues: [10]",
        )

    def test_accepts_non_admin_project_members(self):
        membership = SimpleNamespace(user_id=10, user=SimpleNamespace())
        queryset = MagicMock()
        queryset.select_related.return_value = [membership]

        with (
            patch("apps.bugboardapi.issue_rules.ProjectMembership") as membership_model,
            patch("apps.bugboardapi.issue_rules.is_admin_user", return_value=False),
        ):
            membership_model.objects.filter.return_value = queryset
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
            patch("apps.bugboardapi.authentication.RevokedTokenSession") as session_model,
        ):
            session_model.objects.filter.return_value.exists.return_value = True

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
            patch("apps.bugboardapi.authentication.RevokedTokenSession") as session_model,
        ):
            session_model.objects.filter.return_value.exists.return_value = False

            self.assertEqual(RevocableJWTAuthentication().authenticate(request), (user, token))
