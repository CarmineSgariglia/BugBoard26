from __future__ import annotations

from rest_framework.exceptions import ValidationError

from ...roles import is_admin_user
from ..projects.models import ProjectMembership


def validate_project_assignee_ids(*, project, assignee_ids: list[int] | None) -> None:
    if assignee_ids is None:
        return
    if not assignee_ids:
        return

    memberships = list(
        ProjectMembership.objects.filter(project=project, user_id__in=assignee_ids).select_related("user")
    )
    member_ids = {membership.user_id for membership in memberships}
    invalid_ids = [user_id for user_id in assignee_ids if user_id not in member_ids]
    if invalid_ids:
        raise ValidationError({"assigneeIds": f"Users must be members of project: {invalid_ids}"})

    admin_ids = [membership.user_id for membership in memberships if is_admin_user(membership.user)]
    if admin_ids:
        raise ValidationError({"assigneeIds": f"Admin users cannot be assigned to issues: {admin_ids}"})
