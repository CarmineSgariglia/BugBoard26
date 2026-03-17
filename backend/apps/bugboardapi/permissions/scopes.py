from __future__ import annotations

from typing import TYPE_CHECKING

from ..modules.projects.models import Project
from .checks import is_admin

if TYPE_CHECKING:
    from django.contrib.auth.models import User


def user_project_ids(user: User):
    if is_admin(user):
        return Project.objects.values_list("project_id", flat=True)
    return user.projects.values_list("project_id", flat=True)


def filter_by_project_access(*, queryset, user: User, project_lookup: str = "project_id"):
    if is_admin(user):
        return queryset
    return queryset.filter(**{f"{project_lookup}__in": user_project_ids(user)})
