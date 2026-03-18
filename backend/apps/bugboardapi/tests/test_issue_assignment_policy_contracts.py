from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.bugboardapi.modules.issues.commands import assign_issue_users
from apps.bugboardapi.modules.issues.models import Issue
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


class IssueAssignmentPolicyContractsTests(TestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="assign_policy_admin",
            email="assign_policy_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="assign_policy_member",
            email="assign_policy_member@example.com",
            password="StrongPass123!",
        )
        self.outsider = create_user_with_profile(
            username="assign_policy_outsider",
            email="assign_policy_outsider@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Assign Policy Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Assignment policy issue",
            description="desc",
        )

    def test_assign_issue_users_rejects_non_member_with_user_ids_error_key(self):
        with self.assertRaises(ValidationError) as exc:
            assign_issue_users(
                issue=self.issue,
                actor=self.admin,
                raw_user_ids=[self.outsider.id],
            )

        self.assertEqual(
            str(exc.exception.detail["userIds"]),
            f"Users must be members of project: [{self.outsider.id}]",
        )

    def test_assign_issue_users_rejects_admin_users_with_user_ids_error_key(self):
        with self.assertRaises(ValidationError) as exc:
            assign_issue_users(
                issue=self.issue,
                actor=self.admin,
                raw_user_ids=[self.admin.id],
            )

        self.assertEqual(
            str(exc.exception.detail["userIds"]),
            f"Admin users cannot be assigned to issues: [{self.admin.id}]",
        )

    def test_assign_issue_users_rejects_inactive_members_with_user_ids_error_key(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])

        with self.assertRaises(ValidationError) as exc:
            assign_issue_users(
                issue=self.issue,
                actor=self.admin,
                raw_user_ids=[self.member.id],
            )

        self.assertEqual(
            str(exc.exception.detail["userIds"]),
            f"Users must be members of project: [{self.member.id}]",
        )
