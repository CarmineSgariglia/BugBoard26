from __future__ import annotations

import logging
from functools import partial
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Notification, NotifyType, NotifyUser
from .publisher import publish_created_notifications

if TYPE_CHECKING:
    from django.contrib.auth.models import User

    from ..issues.models import Issue
    from ..projects.models import Project

logger = logging.getLogger(__name__)


def _resolve_notification_project(*, issue: Issue | None = None, project: Project | None = None) -> Project | None:
    if issue is None:
        return project

    issue_project = getattr(issue, "project", None)
    if issue_project is None:
        raise ValidationError({"issue": "Issue must belong to a project"})
    if project is None:
        return issue_project
    if getattr(project, "project_id", None) != getattr(issue_project, "project_id", None):
        raise ValidationError({"project": "Project must match the issue project"})
    return project


def _filter_notification_users(*, users: list[User], actor: User | None = None) -> list[User]:
    actor_id = getattr(actor, "id", None)
    filtered_users: list[User] = []
    seen_user_ids: set[int] = set()
    for user in users:
        user_id = getattr(user, "id", None)
        if user_id is None or user_id == actor_id or user_id in seen_user_ids:
            continue
        seen_user_ids.add(user_id)
        filtered_users.append(user)
    return filtered_users


def _create_notification(
    *,
    notify_type: NotifyType,
    users: list[User],
    actor: User | None = None,
    issue: Issue | None = None,
    project: Project | None = None,
) -> Notification | None:
    project = _resolve_notification_project(issue=issue, project=project)
    filtered_users = _filter_notification_users(users=users, actor=actor)

    if not filtered_users:
        return None

    notification = Notification.objects.create(notify_type=notify_type, issue=issue, project=project)
    notify_users_rows = NotifyUser.objects.bulk_create(
        [NotifyUser(notification=notification, user=user) for user in filtered_users]
    )

    try:
        transaction.on_commit(partial(publish_created_notifications, notify_users_rows))
    except Exception:
        logger.warning(
            "notification_realtime_dispatch_registration_failed",
            extra={"notification_id": notification.notification_id},
            exc_info=True,
        )

    return notification


def mark_notification_as_read(*, notify_user: NotifyUser) -> NotifyUser:
    if notify_user.is_read:
        return notify_user

    notify_user.is_read = True
    notify_user.read_at = timezone.now()
    notify_user.save(update_fields=["is_read", "read_at"])
    return notify_user


def mark_all_notifications_as_read(*, user) -> int:
    return NotifyUser.objects.filter(user=user, is_read=False).update(
        is_read=True,
        read_at=timezone.now(),
    )


def delete_notification_for_user(*, notify_user: NotifyUser) -> None:
    with transaction.atomic():
        notification = Notification.objects.select_for_update().get(
            notification_id=notify_user.notification_id
        )
        NotifyUser.objects.filter(
            notify_user_id=notify_user.notify_user_id,
            user_id=notify_user.user_id,
        ).delete()

        if not NotifyUser.objects.filter(notification_id=notification.notification_id).exists():
            notification.delete()


def notify_project_added(*, users: list[User], project: Project, actor: User | None = None) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.PROJECT_ADDED,
        users=users,
        actor=actor,
        project=project,
    )


def notify_project_removed(
    *,
    users: list[User],
    project: Project | None = None,
    actor: User | None = None,
) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.PROJECT_REMOVED,
        users=users,
        actor=actor,
        project=project,
    )


def notify_project_unassigned(*, users: list[User], project: Project) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.PROJECT_UNASSIGNED,
        users=users,
        project=project,
    )


def notify_issue_added(*, users: list[User], issue: Issue, actor: User | None = None) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.ISSUE_ADDED,
        users=users,
        actor=actor,
        issue=issue,
    )


def notify_issue_updated(*, users: list[User], issue: Issue, actor: User | None = None) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.ISSUE_UPDATED,
        users=users,
        actor=actor,
        issue=issue,
    )


def notify_issue_assigned(*, users: list[User], issue: Issue, actor: User | None = None) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.ISSUE_ASSIGNED,
        users=users,
        actor=actor,
        issue=issue,
    )


def notify_issue_unassigned(*, users: list[User], issue: Issue, actor: User | None = None) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.ISSUE_UNASSIGNED,
        users=users,
        actor=actor,
        issue=issue,
    )


def notify_issue_closed(*, users: list[User], issue: Issue, actor: User | None = None) -> Notification | None:
    return _create_notification(
        notify_type=NotifyType.ISSUE_CLOSED,
        users=users,
        actor=actor,
        issue=issue,
    )
