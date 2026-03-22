from __future__ import annotations

from django.contrib.auth.models import Group, User

__all__ = (
    "ADMIN_GROUP_NAME",
    "DEVELOPER_GROUP_NAME",
    "GLOBAL_ROLE_CHOICES",
    "assign_global_role",
    "get_global_role",
    "is_admin_user",
)

# Global roles are implemented as Django groups, and the staff flag is used to allow access to the admin site for users with the admin role.
ADMIN_GROUP_NAME = "admin"
DEVELOPER_GROUP_NAME = "developer"
GLOBAL_ROLE_NAMES = frozenset({ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME})
_ROLE_PRIORITY = (ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME)
GLOBAL_ROLE_CHOICES = (
    (ADMIN_GROUP_NAME, "Admin"),
    (DEVELOPER_GROUP_NAME, "Developer"),
)

# returns the set of group names that the user belongs to. This is used to determine the user's global role based on their group memberships.
def _user_group_names(user: User) -> set[str]:
    prefetched_groups = getattr(user, "_prefetched_objects_cache", {}).get("groups")
    if prefetched_groups is not None:
        return {group.name for group in prefetched_groups}
    return set(user.groups.values_list("name", flat=True))

'''
returns the highest priority role name that the user belongs to, or None if the user doesn't belong to any of the global role groups. This is used to determine the user's global role based on their group memberships.
'''

def _group_role_for_names(group_names: set[str]) -> str | None:
    for role_name in _ROLE_PRIORITY:
        if role_name in group_names:
            return role_name
    return None

def get_global_role(user: User | None) -> str | None:
    if user is None:
        return None
    if getattr(user, "is_superuser", False):
        return ADMIN_GROUP_NAME
    if not getattr(user, "is_authenticated", False):
        return None

    return _group_role_for_names(_user_group_names(user))


def assign_global_role(user: User, role_name: str) -> None:
    if role_name not in GLOBAL_ROLE_NAMES:
        raise ValueError(f"Unsupported global role: {role_name}")

    group, _ = Group.objects.get_or_create(name=role_name)
    user.groups.set([group])

    desired_is_staff = user.is_superuser or role_name == ADMIN_GROUP_NAME
    if user.is_staff != desired_is_staff:
        user.is_staff = desired_is_staff
        user.save(update_fields=["is_staff"])


def is_admin_user(user: User | None) -> bool:
    return get_global_role(user) == ADMIN_GROUP_NAME
