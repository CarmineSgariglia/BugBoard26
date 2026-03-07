from __future__ import annotations

from django.contrib.auth.models import Group, User

ADMIN_GROUP_NAME = "admin"
DEVELOPER_GROUP_NAME = "developer"
GLOBAL_ROLE_CHOICES = (
    (ADMIN_GROUP_NAME, "Admin"),
    (DEVELOPER_GROUP_NAME, "Developer"),
)


def ensure_global_role_groups() -> dict[str, Group]:
    admin_group, _ = Group.objects.get_or_create(name=ADMIN_GROUP_NAME)
    developer_group, _ = Group.objects.get_or_create(name=DEVELOPER_GROUP_NAME)
    return {
        ADMIN_GROUP_NAME: admin_group,
        DEVELOPER_GROUP_NAME: developer_group,
    }


def get_global_role(user: User | None) -> str | None:
    if user is None:
        return None
    if getattr(user, "is_superuser", False):
        return ADMIN_GROUP_NAME
    if not getattr(user, "is_authenticated", False):
        return None

    group_names = set(user.groups.values_list("name", flat=True))
    if ADMIN_GROUP_NAME in group_names:
        return ADMIN_GROUP_NAME
    if DEVELOPER_GROUP_NAME in group_names:
        return DEVELOPER_GROUP_NAME
    return None


def assign_global_role(user: User, role_name: str) -> None:
    if role_name not in {ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME}:
        raise ValueError(f"Unsupported global role: {role_name}")

    groups = ensure_global_role_groups()
    user.groups.set([groups[role_name]])

    desired_is_staff = user.is_superuser or role_name == ADMIN_GROUP_NAME
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


def is_developer_user(user: User | None) -> bool:
    return has_global_role(user, DEVELOPER_GROUP_NAME)
