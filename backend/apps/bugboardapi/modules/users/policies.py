from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied, ValidationError

from ...roles import is_admin_user


def ensure_can_edit_user(*, actor: User, target_user: User, payload) -> None:
    if actor != target_user and not is_admin_user(actor):
        raise PermissionDenied("Cannot edit other users")
    if is_admin_user(actor) and actor == target_user and any(
        field in payload for field in {"active", "group", "isAdmin"}
    ):
        raise PermissionDenied("You cannot change your own active status or role")
    if not is_admin_user(actor):
        forbidden_fields = {"isAdmin", "group", "active"}
        if any(field in payload for field in forbidden_fields):
            raise PermissionDenied("You cannot modify admin or active flags")


def ensure_can_change_password(*, actor: User, target_user: User) -> bool:
    is_admin_reset = is_admin_user(actor) and actor != target_user
    if actor != target_user and not is_admin_user(actor):
        raise PermissionDenied("Cannot change password for other users")
    return is_admin_reset


def validate_password_change_request(
    *,
    actor: User,
    target_user: User,
    current_password: str,
    new_password: str,
) -> None:
    is_admin_reset = ensure_can_change_password(actor=actor, target_user=target_user)
    if is_admin_reset:
        if target_user.check_password(new_password):
            raise ValidationError({"newPassword": "New password must be different from current password"})
    else:
        if not current_password:
            raise ValidationError({"currentPassword": "Current password is required"})
        if not target_user.check_password(current_password):
            raise ValidationError({"currentPassword": "Current password is incorrect"})

    if target_user.check_password(new_password):
        raise ValidationError({"newPassword": "New password must be different from current password"})


def validate_status_change_request(*, actor: User, target_user: User, active) -> None:
    if not isinstance(active, bool):
        raise ValidationError({"active": "Boolean value is required"})
    if actor == target_user:
        raise PermissionDenied("You cannot deactivate your own account")


def ensure_can_upload_profile_image(*, actor: User, target_user: User) -> None:
    if actor != target_user and not is_admin_user(actor):
        raise PermissionDenied("Cannot edit other users")
