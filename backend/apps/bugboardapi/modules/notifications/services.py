import logging
from functools import partial

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ..issues.models import Issue
from ..projects.models import Project
from .models import Notification, NotifyType, NotifyUser
from .publisher import publish_created_notifications

logger = logging.getLogger(__name__)


def notify_users(
    *,
    notify_type: NotifyType,
    users: list[User],
    actor: User | None = None,
    issue: Issue | None = None,
    project: Project | None = None,
) -> Notification | None:
    if issue is not None:
        issue_project = getattr(issue, "project", None)
        if issue_project is None:
            raise ValidationError({"issue": "Issue must belong to a project"})
        if project is None:
            project = issue_project
        elif getattr(project, "project_id", None) != getattr(issue_project, "project_id", None):
            raise ValidationError({"project": "Project must match the issue project"})

    actor_id = getattr(actor, "id", None)
    filtered_users: list[User] = []
    seen_user_ids: set[int] = set()
    for user in users:
        user_id = getattr(user, "id", None)
        if user_id is None or user_id == actor_id or user_id in seen_user_ids:
            continue
        seen_user_ids.add(user_id)
        filtered_users.append(user)

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
