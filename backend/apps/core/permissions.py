"""Reusable DRF permission classes for the core app."""
from __future__ import annotations

from rest_framework.permissions import BasePermission

from .models import IssueAssignee, ProjectMembership, UserProfile


def is_admin(user) -> bool:
    """Return True if the user has admin privileges."""
    if not user.is_authenticated:
        return False
    profile = getattr(user, "profile", None)
    return user.is_superuser or user.is_staff or bool(profile and profile.is_admin)


class IsAdminUser(BasePermission):
    """Allow access only to admin users (superuser, staff, or profile.is_admin)."""

    def has_permission(self, request, view):
        return is_admin(request.user)


class IsProjectMember(BasePermission):
    """Allow access only to users who are members of the target project.

    Admins bypass the check.  The view must set ``self.project`` or the
    object must expose a ``project`` attribute.
    """

    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True
        project = getattr(obj, "project", obj)
        return ProjectMembership.objects.filter(project=project, user=request.user).exists()


class IsAssigneeOrAdmin(BasePermission):
    """Allow access to admins or users assigned to the issue.

    The view object must be an ``Issue`` instance (or have an ``issue``
    attribute pointing to one).
    """

    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True
        issue = getattr(obj, "issue", obj)
        return IssueAssignee.objects.filter(issue=issue, user=request.user).exists()
