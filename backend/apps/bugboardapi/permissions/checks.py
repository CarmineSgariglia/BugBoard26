from __future__ import annotations
from typing import TYPE_CHECKING

from rest_framework.exceptions import PermissionDenied

from ..modules.issues.membership import is_developer_issue_assignee
from ..modules.projects.membership import is_project_member
from ..roles import is_admin_user

if TYPE_CHECKING:
    from django.contrib.auth.models import User

    from ..modules.issues.models import Issue
    from ..modules.projects.models import Project


def require_admin(user: User) -> None:
    if not is_admin_user(user):
        raise PermissionDenied("Admin privileges required")


def require_project_access(user: User, project: Project) -> None:
    if is_admin_user(user):
        return
    if not is_project_member(user=user, project=project):
        raise PermissionDenied("You do not have access to this project")


def require_assignee_or_admin(user: User, issue: Issue) -> None:
    if is_admin_user(user):
        return
    if not is_developer_issue_assignee(issue=issue, user=user):
        raise PermissionDenied("Only assigned users or admins can modify this issue")
