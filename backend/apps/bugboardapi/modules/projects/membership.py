from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import QuerySet

from ...roles import is_admin_user
from .models import Project, ProjectMembership


def project_memberships_queryset(
    *,
    project: Project,
    active_only: bool = False,
) -> QuerySet[ProjectMembership]:
    queryset = (
        ProjectMembership.objects.filter(project=project)
        .select_related("user", "user__profile")
        .prefetch_related("user__groups")
    )
    if active_only:
        queryset = queryset.filter(user__is_active=True)
    return queryset


def is_project_member(*, user: User, project: Project) -> bool:
    return ProjectMembership.objects.filter(project=project, user=user).exists()


def admin_project_subscriptions(
    *,
    project: Project,
    active_only: bool = False,
) -> list[ProjectMembership]:
    memberships = list(
        project_memberships_queryset(
            project=project,
            active_only=active_only,
        )
    )
    return [membership for membership in memberships if is_admin_user(membership.user)]


def admin_project_subscription_users(*, project: Project, active_only: bool = False) -> list[User]:
    return [membership.user for membership in admin_project_subscriptions(project=project, active_only=active_only)]


def is_admin_project_subscribed(*, project: Project, user: User) -> bool:
    if not is_admin_user(user):
        return False
    return ProjectMembership.objects.filter(project=project, user=user).exists()


def subscribe_admin_to_project(*, project: Project, user: User) -> ProjectMembership:
    membership, _ = ProjectMembership.objects.get_or_create(project=project, user=user)
    return membership


def unsubscribe_admin_from_project(*, project: Project, user: User) -> None:
    ProjectMembership.objects.filter(project=project, user=user).delete()


def developer_project_memberships(
    *,
    project: Project,
    active_only: bool = False,
) -> list[ProjectMembership]:
    memberships = list(
        project_memberships_queryset(
            project=project,
            active_only=active_only,
        )
    )
    return [membership for membership in memberships if not is_admin_user(membership.user)]


def visible_project_memberships(
    *,
    project: Project,
    include_admins: bool,
    active_only: bool = False,
) -> list[ProjectMembership]:
    memberships = list(
        project_memberships_queryset(
            project=project,
            active_only=active_only,
        )
    )
    if include_admins:
        return memberships
    return [membership for membership in memberships if not is_admin_user(membership.user)]


def assignable_project_memberships(
    *,
    project: Project,
    memberships=None,
) -> list[ProjectMembership]:
    candidate_memberships = memberships
    if candidate_memberships is None:
        candidate_memberships = developer_project_memberships(project=project)

    return [membership for membership in candidate_memberships if _is_assignable_project_membership(membership)]


def classify_project_assignment_user_ids(
    *,
    project: Project,
    user_ids: list[int],
) -> tuple[list[int], list[int], list[int]]:
    memberships = list(project_memberships_queryset(project=project).filter(user_id__in=user_ids))
    membership_by_user_id = {membership.user_id: membership for membership in memberships}

    invalid_ids = [user_id for user_id in user_ids if user_id not in membership_by_user_id]
    admin_ids = [membership.user_id for membership in memberships if is_admin_user(membership.user)]

    inactive_ids: list[int] = []
    for user_id in user_ids:
        membership = membership_by_user_id.get(user_id)
        if membership is None:
            continue
        if is_admin_user(membership.user):
            continue
        if not _is_assignable_project_membership(membership):
            inactive_ids.append(user_id)

    return invalid_ids, admin_ids, inactive_ids


def project_ids_for_user(*, user: User):
    if is_admin_user(user):
        return Project.objects.values_list("project_id", flat=True)
    return ProjectMembership.objects.filter(user=user).values_list("project_id", flat=True)


def _is_assignable_project_membership(membership: ProjectMembership) -> bool:
    return membership.user.is_active and not is_admin_user(membership.user)
