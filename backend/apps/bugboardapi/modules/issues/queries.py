from django.db.models import Count, Q

from ...roles import is_admin_user
from ..projects.models import ProjectMembership
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


def list_issue_suggestion_memberships(*, issue):
    memberships_qs = (
        ProjectMembership.objects.filter(project=issue.project, user__is_active=True)
        .select_related("user", "user__profile")
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
    return [membership for membership in memberships_qs if not is_admin_user(membership.user)]
