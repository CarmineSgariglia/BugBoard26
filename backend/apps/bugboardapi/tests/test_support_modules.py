from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.bugboardapi.issue_rules import validate_project_assignee_ids
from apps.bugboardapi.passwords import (
    build_password_validation_user,
    ensure_valid_password,
)
from apps.bugboardapi.roles import ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile
from apps.bugboardapi.upload_security import (
    validate_issue_attachment,
    validate_profile_image,
)


class UploadSecurityTests(SimpleTestCase):
    def test_validate_profile_image_accepts_valid_png(self):
        image = SimpleUploadedFile(
            "avatar.png",
            b"\x89PNG\r\n\x1a\nvalid",
            content_type="image/png",
        )
        extension, size = validate_profile_image(image)
        self.assertEqual(extension, "png")
        self.assertEqual(size, len(image.read()))

    def test_validate_profile_image_rejects_signature_mismatch(self):
        image = SimpleUploadedFile(
            "avatar.png",
            b"not-a-real-png",
            content_type="image/png",
        )
        with self.assertRaises(ValidationError):
            validate_profile_image(image)

    def test_validate_issue_attachment_rejects_extension_mismatch(self):
        attachment = SimpleUploadedFile(
            "report.txt",
            b"%PDF-1.7 fake",
            content_type="application/pdf",
        )
        with self.assertRaises(ValidationError):
            validate_issue_attachment(attachment)

    def test_validate_issue_attachment_rejects_video_signature_mismatch(self):
        attachment = SimpleUploadedFile(
            "clip.mp4",
            b"not-an-mp4",
            content_type="video/mp4",
        )
        with self.assertRaises(ValidationError):
            validate_issue_attachment(attachment)


class PasswordHelperTests(SimpleTestCase):
    def test_build_password_validation_user_prefers_attrs_over_instance(self):
        user = User(username="password_helper", email="password_helper@example.com")
        candidate = build_password_validation_user(
            instance=user,
            attrs={"username": "updated_name", "email": "updated@example.com"},
        )
        self.assertEqual(candidate.username, "updated_name")
        self.assertEqual(candidate.email, "updated@example.com")

    def test_ensure_valid_password_raises_field_specific_errors(self):
        with self.assertRaises(serializers.ValidationError) as exc:
            ensure_valid_password("12345678", field_name="newPassword")
        self.assertIn("newPassword", exc.exception.detail)


class IssueRulesDirectTests(TestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="rule_admin",
            email="rule_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="rule_member",
            email="rule_member@example.com",
            password="StrongPass123!",
        )
        self.outsider = create_user_with_profile(
            username="rule_outsider",
            email="rule_outsider@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Rule Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )

    def test_validate_project_assignee_ids_allows_none_or_empty(self):
        validate_project_assignee_ids(project=self.project, assignee_ids=None)
        validate_project_assignee_ids(project=self.project, assignee_ids=[])

    def test_validate_project_assignee_ids_rejects_non_member(self):
        with self.assertRaises(ValidationError):
            validate_project_assignee_ids(
                project=self.project,
                assignee_ids=[self.outsider.id],
            )

    def test_validate_project_assignee_ids_rejects_admin_users(self):
        with self.assertRaises(ValidationError):
            validate_project_assignee_ids(
                project=self.project,
                assignee_ids=[self.admin.id],
            )


class ManagementCommandTests(TestCase):
    def test_seed_roles_creates_expected_groups(self):
        out = StringIO()
        call_command("seed_roles", stdout=out)
        self.assertTrue(Group.objects.filter(name=ADMIN_GROUP_NAME).exists())
        self.assertTrue(Group.objects.filter(name=DEVELOPER_GROUP_NAME).exists())
        developer_group = Group.objects.get(name=DEVELOPER_GROUP_NAME)
        developer_codenames = set(
            developer_group.permissions.values_list("codename", flat=True)
        )
        self.assertIn("view_project", developer_codenames)
        self.assertIn("change_notifyuser", developer_codenames)

class RelabelCommandTests(SimpleTestCase):
    @patch("apps.bugboardapi.management.commands.relabel_bugboardapi.connection")
    def test_relabel_command_updates_known_tables(self, mock_connection):
        mock_connection.introspection.table_names.return_value = [
            "django_migrations",
            "django_content_type",
        ]
        cursor = MagicMock()
        cursor.__enter__.return_value = cursor
        cursor.rowcount = 2
        mock_connection.cursor.return_value = cursor

        out = StringIO()
        call_command("relabel_bugboardapi", stdout=out)

        self.assertEqual(cursor.execute.call_count, 2)
        self.assertIn("Relabel complete", out.getvalue())
