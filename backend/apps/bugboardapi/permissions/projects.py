from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from ..models import Project, ProjectMembership
from .base import is_admin


def check_admin(user: User) -> None:
    if not is_admin(user):
        raise PermissionDenied("Admin privileges required")


def user_project_ids(user: User):
    if is_admin(user):
        return Project.objects.values_list("project_id", flat=True)
    return ProjectMembership.objects.filter(user=user).values_list("project_id", flat=True)


def ensure_project_access(user: User, project: Project) -> None:
    if is_admin(user):
        return
    if not ProjectMembership.objects.filter(project=project, user=user).exists():
        raise PermissionDenied("You do not have access to this project")


class IsProjectMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True
        project = getattr(obj, "project", obj)
        return ProjectMembership.objects.filter(project=project, user=request.user).exists()
