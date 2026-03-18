from django.db.models import Count, Q

from ..projects.membership import assignable_project_memberships, project_memberships_queryset
from .models import IssueStatus


def apply_issue_filters(queryset, request):
    q = request.query_params.get("q")
    category = request.query_params.get("category")
    priority = request.query_params.get("priority")
    tag = request.query_params.get("tag")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if q:
        queryset = queryset.filter(title__icontains=q)
    if category:
        queryset = queryset.filter(issue_type=category)
    if priority:
        queryset = queryset.filter(priority=priority)
    if tag:
        queryset = queryset.filter(tags__name__iexact=tag)
    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)
    return queryset.distinct()


def list_project_issues_queryset(*, project, request):
    queryset = (
        project.issues.select_related("project", "reporter", "reporter__profile")
        .prefetch_related("assignees", "tags")
    )
    return apply_issue_filters(queryset, request)


def list_issue_suggestion_memberships(*, issue):
    memberships_qs = (
        project_memberships_queryset(project=issue.project, active_only=True)
        .annotate(
            open_count=Count(
                "user__issue_assignments",
                filter=Q(
                    user__issue_assignments__issue__status__in=[
                        IssueStatus.TODO,
                        IssueStatus.IN_PROGRESS,
                    ]
                ),
                distinct=True,
            )
        )
        .order_by("open_count", "user__username")
    )
    return assignable_project_memberships(
        project=issue.project,
        memberships=memberships_qs,
    )
