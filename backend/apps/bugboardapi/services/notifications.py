from django.contrib.auth.models import User

from ..models import Issue, Notification, NotifyType, NotifyUser, Project


def notify_users(
    *,
    notify_type: NotifyType,
    users: list[User],
    issue: Issue | None = None,
    project: Project | None = None,
) -> Notification:
    notification = Notification.objects.create(notify_type=notify_type, issue=issue, project=project)
    NotifyUser.objects.bulk_create(
        [NotifyUser(notification=notification, user=user) for user in users],
        ignore_conflicts=True,
    )
    return notification
