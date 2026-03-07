from rest_framework.permissions import BasePermission

from ..models import IssueAssignee
from .base import is_admin
from .projects import ensure_project_access


def ensure_issue_access(user, issue):
    ensure_project_access(user, issue.project)


class IsAssigneeOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True
        issue = getattr(obj, "issue", obj)
        return IssueAssignee.objects.filter(issue=issue, user=request.user).exists()
