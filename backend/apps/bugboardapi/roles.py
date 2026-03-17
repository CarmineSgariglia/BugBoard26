from __future__ import annotations

from django.contrib.auth.models import Group, User

ADMIN_GROUP_NAME = "admin"
DEVELOPER_GROUP_NAME = "developer"
GLOBAL_ROLE_NAMES = frozenset({ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME})
_ROLE_PRIORITY = (ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME)
GLOBAL_ROLE_CHOICES = (
    (ADMIN_GROUP_NAME, "Admin"),
    (DEVELOPER_GROUP_NAME, "Developer"),
)


def _role_group(role_name: str) -> Group:
    group, _ = Group.objects.get_or_create(name=role_name)
    return group


def _user_group_names(user: User) -> set[str]:
    return set(user.groups.values_list("name", flat=True))


def _group_role_for_names(group_names: set[str]) -> str | None:
    for role_name in _ROLE_PRIORITY:
        if role_name in group_names:
            return role_name
    return None


def _desired_staff_flag(*, user: User, role_name: str) -> bool:
    return user.is_superuser or role_name == ADMIN_GROUP_NAME


def ensure_global_role_groups() -> dict[str, Group]:
    return {role_name: _role_group(role_name) for role_name in _ROLE_PRIORITY}


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

    groups = ensure_global_role_groups()
    user.groups.set([groups[role_name]])

    desired_is_staff = _desired_staff_flag(user=user, role_name=role_name)
    if user.is_staff != desired_is_staff:
        user.is_staff = desired_is_staff
        user.save(update_fields=["is_staff"])


def has_global_role(user: User | None, *role_names: str) -> bool:
    current_role = get_global_role(user)
    if current_role is None:
        return False
    if current_role == ADMIN_GROUP_NAME:
        return True
    return current_role in role_names


def is_admin_user(user: User | None) -> bool:
    return has_global_role(user, ADMIN_GROUP_NAME)
