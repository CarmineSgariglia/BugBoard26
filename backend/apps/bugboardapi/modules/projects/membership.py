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


def ensure_project_creator_membership(*, project: Project) -> ProjectMembership:
    membership, _ = ProjectMembership.objects.get_or_create(
        project=project,
        user_id=project.created_by_id,
    )
    return membership


def mutable_project_team_memberships_queryset(*, project: Project) -> QuerySet[ProjectMembership]:
    return project_memberships_queryset(project=project).exclude(user_id=project.created_by_id)


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
        candidate_memberships = project_memberships_queryset(project=project)

    return [
        membership
        for membership in candidate_memberships
        if membership.user.is_active and not is_admin_user(membership.user)
    ]


def project_ids_for_user(*, user: User):
    if is_admin_user(user):
        return Project.objects.values_list("project_id", flat=True)
    return ProjectMembership.objects.filter(user=user).values_list("project_id", flat=True)
