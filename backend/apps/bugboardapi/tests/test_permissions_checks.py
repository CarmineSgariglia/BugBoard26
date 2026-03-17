from django.test import TestCase
from rest_framework.exceptions import PermissionDenied

from apps.bugboardapi.modules.issues.models import Issue, IssueAssignee
from apps.bugboardapi.permissions import (
    check_admin as public_check_admin,
    check_assignee_or_admin as public_check_assignee_or_admin,
    ensure_issue_access as public_ensure_issue_access,
    ensure_project_access as public_ensure_project_access,
    filter_by_project_access as public_filter_by_project_access,
    is_admin as public_is_admin,
    user_project_ids as public_user_project_ids,
)
from apps.bugboardapi.permissions.checks import (
    check_admin,
    check_assignee_or_admin,
    ensure_issue_access,
    ensure_project_access,
)
from apps.bugboardapi.permissions.helpers import is_issue_assignee, is_project_member
from apps.bugboardapi.permissions.scopes import filter_by_project_access, user_project_ids
from apps.bugboardapi.modules.projects.models import Project
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


class PermissionsChecksTests(TestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="perm_admin",
            email="perm_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="perm_member",
            email="perm_member@example.com",
            password="StrongPass123!",
        )
        self.outsider = create_user_with_profile(
            username="perm_outsider",
            email="perm_outsider@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Permissions Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.other_project = create_project_with_members(
            created_by=self.admin,
            name="Permissions Other Project",
            admin_members=[self.admin],
            developer_members=[],
        )
        self.issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="Permissions issue",
            description="desc",
        )
        IssueAssignee.objects.create(issue=self.issue, user=self.member)

    def test_check_admin_denies_non_admin_with_same_message(self):
        with self.assertRaisesMessage(PermissionDenied, "Admin privileges required"):
            check_admin(self.member)

    def test_package_level_permissions_exports_match_public_api(self):
        self.assertTrue(callable(public_is_admin))
        self.assertIs(public_check_admin, check_admin)
        self.assertIs(public_user_project_ids, user_project_ids)
        self.assertIs(public_filter_by_project_access, filter_by_project_access)
        self.assertIs(public_ensure_project_access, ensure_project_access)
        self.assertIs(public_ensure_issue_access, ensure_issue_access)
        self.assertIs(public_check_assignee_or_admin, check_assignee_or_admin)

    def test_check_admin_allows_admin(self):
        check_admin(self.admin)

    def test_user_project_ids_is_scoped_for_non_admin_and_global_for_admin(self):
        member_ids = set(user_project_ids(self.member))
        admin_ids = set(user_project_ids(self.admin))

        self.assertEqual(member_ids, {self.project.project_id})
        self.assertIn(self.project.project_id, admin_ids)
        self.assertIn(self.other_project.project_id, admin_ids)

    def test_filter_by_project_access_scopes_querysets_for_non_admin_and_not_for_admin(self):
        member_ids = set(
            filter_by_project_access(
                queryset=Project.objects.all(),
                user=self.member,
            ).values_list("project_id", flat=True)
        )
        admin_ids = set(
            filter_by_project_access(
                queryset=Project.objects.all(),
                user=self.admin,
            ).values_list("project_id", flat=True)
        )

        self.assertEqual(member_ids, {self.project.project_id})
        self.assertIn(self.project.project_id, admin_ids)
        self.assertIn(self.other_project.project_id, admin_ids)

    def test_project_membership_predicate(self):
        self.assertTrue(is_project_member(self.member, self.project))
        self.assertFalse(is_project_member(self.outsider, self.project))

    def test_ensure_project_access_denies_non_member_with_same_message(self):
        with self.assertRaisesMessage(
            PermissionDenied, "You do not have access to this project"
        ):
            ensure_project_access(self.outsider, self.project)

    def test_issue_assignee_predicate(self):
        self.assertTrue(is_issue_assignee(self.member, self.issue))
        self.assertFalse(is_issue_assignee(self.outsider, self.issue))

    def test_ensure_issue_access_denies_user_without_project_access(self):
        with self.assertRaisesMessage(
            PermissionDenied, "You do not have access to this project"
        ):
            ensure_issue_access(self.outsider, self.issue)

    def test_check_assignee_or_admin_denies_non_assignee_with_same_message(self):
        with self.assertRaisesMessage(
            PermissionDenied, "Only assigned users or admins can modify this issue"
        ):
            check_assignee_or_admin(self.outsider, self.issue)

    def test_check_assignee_or_admin_allows_assignee_and_admin(self):
        check_assignee_or_admin(self.member, self.issue)
        check_assignee_or_admin(self.admin, self.issue)
