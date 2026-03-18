from __future__ import annotations

from rest_framework.exceptions import ValidationError

from ...roles import is_admin_user
from ..projects.membership import assignable_project_memberships, project_memberships_queryset


def _validate_assignable_project_user_ids(
    *,
    project,
    user_ids: list[int] | None,
    field_name: str,
) -> None:
    if user_ids is None:
        return
    if not user_ids:
        return

    memberships = list(project_memberships_queryset(project=project).filter(user_id__in=user_ids))
    member_ids = {membership.user_id for membership in memberships}
    invalid_ids = [user_id for user_id in user_ids if user_id not in member_ids]
    if invalid_ids:
        raise ValidationError({field_name: f"Users must be members of project: {invalid_ids}"})

    admin_ids = [membership.user_id for membership in memberships if is_admin_user(membership.user)]
    if admin_ids:
        raise ValidationError({field_name: f"Admin users cannot be assigned to issues: {admin_ids}"})

    assignable_user_ids = {
        membership.user_id
        for membership in assignable_project_memberships(
            project=project,
            memberships=memberships,
        )
    }
    inactive_ids = [user_id for user_id in user_ids if user_id not in assignable_user_ids]
    if inactive_ids:
        raise ValidationError({field_name: f"Users must be members of project: {inactive_ids}"})


def validate_project_assignee_ids(*, project, assignee_ids: list[int] | None) -> None:
    _validate_assignable_project_user_ids(
        project=project,
        user_ids=assignee_ids,
        field_name="assigneeIds",
    )


def validate_issue_assignment_user_ids(*, project, user_ids: list[int] | None) -> None:
    _validate_assignable_project_user_ids(
        project=project,
        user_ids=user_ids,
        field_name="userIds",
    )
