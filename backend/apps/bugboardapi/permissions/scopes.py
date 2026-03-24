from __future__ import annotations

from typing import TYPE_CHECKING

from ..modules.projects.membership import project_ids_for_user
from ..roles import is_admin_user

if TYPE_CHECKING:
    from django.contrib.auth.models import User


def filter_by_project_access(*, queryset, user: User, project_lookup: str = "project_id"):
    if is_admin_user(user):
        return queryset
    return queryset.filter(**{f"{project_lookup}__in": project_ids_for_user(user=user)})


def first_by_project_access(
    *,
    queryset,
    user: User,
    lookup: dict | None = None,
    project_lookup: str = "project_id",
):
    scoped_queryset = filter_by_project_access(
        queryset=queryset,
        user=user,
        project_lookup=project_lookup,
    )
    if lookup:
        scoped_queryset = scoped_queryset.filter(**lookup)
    return scoped_queryset.first()
