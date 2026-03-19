from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import QuerySet

from ...roles import is_admin_user
from ..projects.membership import admin_project_subscription_users
from .models import Issue, IssueAssignee


def issue_assignees_queryset(
    *,
    issue: Issue,
    active_only: bool = False,
) -> QuerySet[IssueAssignee]:
    queryset = (
        IssueAssignee.objects.filter(issue=issue)
        .select_related("user", "user__profile")
        .prefetch_related("user__groups")
    )
    if active_only:
        queryset = queryset.filter(user__is_active=True)
    return queryset


def developer_issue_assignees(
    *,
    issue: Issue,
    active_only: bool = False,
) -> list[IssueAssignee]:
    assignees = list(issue_assignees_queryset(issue=issue, active_only=active_only))
    return [assignee for assignee in assignees if not is_admin_user(assignee.user)]


def developer_issue_assignee_users(*, issue: Issue, active_only: bool = False) -> list[User]:
    return [assignee.user for assignee in developer_issue_assignees(issue=issue, active_only=active_only)]


def is_developer_issue_assignee(*, issue: Issue, user: User) -> bool:
    if is_admin_user(user):
        return False
    return IssueAssignee.objects.filter(issue=issue, user=user).exists()


def admin_issue_subscriptions(
    *,
    issue: Issue,
    active_only: bool = False,
) -> list[IssueAssignee]:
    assignees = list(issue_assignees_queryset(issue=issue, active_only=active_only))
    return [assignee for assignee in assignees if is_admin_user(assignee.user)]


def admin_issue_subscription_users(*, issue: Issue, active_only: bool = False) -> list[User]:
    return [assignee.user for assignee in admin_issue_subscriptions(issue=issue, active_only=active_only)]


def effective_admin_issue_subscription_users(*, issue: Issue, active_only: bool = False) -> list[User]:
    project_admin_ids = {
        user.id
        for user in admin_project_subscription_users(
            project=issue.project,
            active_only=active_only,
        )
    }
    return [
        user
        for user in admin_issue_subscription_users(issue=issue, active_only=active_only)
        if user.id in project_admin_ids
    ]


def is_admin_issue_subscribed(*, issue: Issue, user: User) -> bool:
    if not is_admin_user(user):
        return False
    return IssueAssignee.objects.filter(issue=issue, user=user).exists()


def subscribe_admin_to_issue(*, issue: Issue, user: User) -> IssueAssignee:
    assignee, _ = IssueAssignee.objects.get_or_create(issue=issue, user=user)
    return assignee


def unsubscribe_admin_from_issue(*, issue: Issue, user: User) -> None:
    IssueAssignee.objects.filter(issue=issue, user=user).delete()
