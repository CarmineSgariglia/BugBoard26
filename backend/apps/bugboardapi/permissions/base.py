from rest_framework.permissions import BasePermission


def is_admin(user) -> bool:
    if not user.is_authenticated:
        return False
    profile = getattr(user, "profile", None)
    return user.is_superuser or user.is_staff or bool(profile and profile.is_admin)


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)
