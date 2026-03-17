from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.exceptions import PermissionDenied

from ..roles import is_admin_user
from .helpers import is_issue_assignee, is_project_member

if TYPE_CHECKING:
    from django.contrib.auth.models import User

    from ..modules.issues.models import Issue
    from ..modules.projects.models import Project


def is_admin(user: User | None) -> bool:
    return is_admin_user(user)


def check_admin(user: User) -> None:
    if not is_admin(user):
        raise PermissionDenied("Admin privileges required")


def ensure_project_access(user: User, project: Project) -> None:
    if is_admin(user):
        return
    if not is_project_member(user, project):
        raise PermissionDenied("You do not have access to this project")


def ensure_issue_access(user: User, issue: Issue) -> None:
    ensure_project_access(user, issue.project)


def check_assignee_or_admin(user: User, issue: Issue) -> None:
    if is_admin(user):
        return
    if not is_issue_assignee(user, issue):
        raise PermissionDenied("Only assigned users or admins can modify this issue")
