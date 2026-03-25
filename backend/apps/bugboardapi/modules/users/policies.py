from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied, ValidationError

from ...roles import is_admin_user


SUPERUSER_CLIENT_MANAGEMENT_FORBIDDEN_MESSAGE = (
    "Django superusers cannot be managed from the client"
)


def ensure_client_can_manage_target_user(*, target_user: User) -> None:
    if target_user.is_superuser:
        raise PermissionDenied(SUPERUSER_CLIENT_MANAGEMENT_FORBIDDEN_MESSAGE)


def ensure_can_edit_user(*, actor: User, target_user: User, payload) -> None:
    is_admin_actor = is_admin_user(actor)
    if actor != target_user and not is_admin_actor:
        raise PermissionDenied("Cannot edit other users")
    ensure_client_can_manage_target_user(target_user=target_user)
    if is_admin_actor and actor == target_user and any(
        field in payload for field in {"active", "group", "isAdmin"}
    ):
        raise PermissionDenied("You cannot change your own active status or role")
    if not is_admin_actor:
        forbidden_fields = {"isAdmin", "group", "active"}
        if any(field in payload for field in forbidden_fields):
            raise PermissionDenied("You cannot modify admin or active flags")


def validate_self_password_change_request(
    *,
    actor: User,
    target_user: User,
    current_password: str,
    new_password: str,
) -> None:
    if actor != target_user:
        raise PermissionDenied("Cannot change password for other users")
    ensure_client_can_manage_target_user(target_user=target_user)
    if not current_password:
        raise ValidationError({"currentPassword": "Current password is required"})
    if not target_user.check_password(current_password):
        raise ValidationError({"currentPassword": "Current password is incorrect"})
    if target_user.check_password(new_password):
        raise ValidationError({"newPassword": "New password must be different from current password"})


def validate_admin_password_reset_request(
    *,
    actor: User,
    target_user: User,
    new_password: str,
) -> None:
    if not is_admin_user(actor):
        raise PermissionDenied("Admin role required")
    if actor == target_user:
        raise PermissionDenied("Use the self-service password endpoint for your own account")
    ensure_client_can_manage_target_user(target_user=target_user)
    if target_user.check_password(new_password):
        raise ValidationError({"newPassword": "New password must be different from current password"})


def ensure_can_upload_profile_image(*, actor: User, target_user: User) -> None:
    if actor != target_user and not is_admin_user(actor):
        raise PermissionDenied("Cannot edit other users")
    ensure_client_can_manage_target_user(target_user=target_user)
