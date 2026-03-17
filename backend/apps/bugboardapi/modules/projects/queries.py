from ...roles import is_admin_user
from ..issues.models import Issue
from ..issues.queries import apply_issue_filters
from .models import Project, ProjectMembership


def list_project_memberships(*, project: Project, include_admins: bool):
    memberships = ProjectMembership.objects.filter(project=project).select_related("user", "user__profile")
    if include_admins:
        return memberships
    return [membership for membership in memberships if not is_admin_user(membership.user)]


def list_project_issues_queryset(*, project: Project, request):
    queryset = (
        Issue.objects.filter(project=project)
        .select_related("project", "reporter", "reporter__profile")
        .prefetch_related("assignees", "tags")
    )
    return apply_issue_filters(queryset, request)
