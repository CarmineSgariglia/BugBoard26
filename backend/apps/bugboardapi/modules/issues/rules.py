from __future__ import annotations

from rest_framework.exceptions import ValidationError

from ..projects.membership import classify_project_assignment_user_ids


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

    invalid_ids, admin_ids, inactive_ids = classify_project_assignment_user_ids(
        project=project,
        user_ids=user_ids,
    )
    if invalid_ids:
        raise ValidationError({field_name: f"Users must be members of project: {invalid_ids}"})

    if admin_ids:
        raise ValidationError({field_name: f"Admin users cannot be assigned to issues: {admin_ids}"})

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
