from types import SimpleNamespace

from django.test import TestCase
from django.urls import resolve

from apps.bugboardapi.modules.issues.models import Issue, IssueStatus, IssueTag
from apps.bugboardapi.modules.issues.queries import list_project_issues_queryset
from apps.bugboardapi.modules.issues.views import ProjectIssueListCreateView
from apps.bugboardapi.modules.tags.models import Tag
from apps.bugboardapi.tests.utils import create_project_with_members, create_user_with_profile


class ProjectIssueBoundaryContractsTests(TestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="boundary_admin",
            email="boundary_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )
        self.member = create_user_with_profile(
            username="boundary_member",
            email="boundary_member@example.com",
            password="StrongPass123!",
        )
        self.project = create_project_with_members(
            created_by=self.admin,
            name="Boundary Project",
            admin_members=[self.admin],
            developer_members=[self.member],
        )
        self.api_tag = Tag.objects.create(name="api")
        self.frontend_tag = Tag.objects.create(name="frontend")

    def test_project_issues_route_is_served_by_issues_module_view(self):
        match = resolve(f"/api/projects/{self.project.project_id}/issues")
        self.assertIs(match.func.view_class, ProjectIssueListCreateView)
        self.assertEqual(match.view_name, "project-issues")

    def test_list_project_issues_queryset_applies_combined_filters(self):
        matching_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="API filtered feature",
            description="desc",
            issue_type="FEATURE",
            status=IssueStatus.TODO,
            priority="HIGH",
        )
        IssueTag.objects.create(issue=matching_issue, tag=self.api_tag)

        wrong_priority_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="API filtered feature low",
            description="desc",
            issue_type="FEATURE",
            status=IssueStatus.TODO,
            priority="LOW",
        )
        IssueTag.objects.create(issue=wrong_priority_issue, tag=self.api_tag)

        wrong_tag_issue = Issue.objects.create(
            project=self.project,
            reporter=self.admin,
            title="API filtered feature wrong tag",
            description="desc",
            issue_type="FEATURE",
            status=IssueStatus.TODO,
            priority="HIGH",
        )
        IssueTag.objects.create(issue=wrong_tag_issue, tag=self.frontend_tag)

        request = SimpleNamespace(
            query_params={
                "q": "API filtered",
                "category": "FEATURE",
                "priority": "HIGH",
                "tag": "api",
            }
        )

        queryset = list_project_issues_queryset(project=self.project, request=request)

        self.assertEqual(list(queryset.values_list("issue_id", flat=True)), [matching_issue.issue_id])
