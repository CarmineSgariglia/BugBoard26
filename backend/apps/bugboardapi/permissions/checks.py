from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied

from ..models import Issue, Project
from ..roles import is_admin_user
from .helpers import is_issue_assignee, is_project_member


def is_admin(user: User | None) -> bool:
    return is_admin_user(user)


def check_admin(user: User) -> None:
    if not is_admin(user):
        raise PermissionDenied("Admin privileges required")


def user_project_ids(user: User):
    if is_admin(user):
        return Project.objects.values_list("project_id", flat=True)
    return user.projects.values_list("project_id", flat=True)


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
