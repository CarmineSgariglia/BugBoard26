from __future__ import annotations

from rest_framework.exceptions import ValidationError

from .models import ProjectMembership

# Validation helper to ensure that provided assignee IDs are valid members of the project
def validate_project_assignee_ids(*, project, assignee_ids: list[int] | None) -> None:
    if assignee_ids is None:
        return
    if not assignee_ids:
        return

    member_ids = set(
        ProjectMembership.objects.filter(project=project, user_id__in=assignee_ids).values_list("user_id", flat=True)
    )
    invalid_ids = [user_id for user_id in assignee_ids if user_id not in member_ids]
    if invalid_ids:
        raise ValidationError({"assigneeIds": f"Users must be members of project: {invalid_ids}"})
