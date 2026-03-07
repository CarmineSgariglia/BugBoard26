from rest_framework.permissions import BasePermission

from ..roles import is_admin_user


def is_admin(user) -> bool:
    return is_admin_user(user)


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)
