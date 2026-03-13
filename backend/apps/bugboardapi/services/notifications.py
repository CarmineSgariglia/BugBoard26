from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError

from ..models import Issue, Notification, NotifyType, NotifyUser, Project


def notify_users(
    *,
    notify_type: NotifyType,
    users: list[User],
    issue: Issue | None = None,
    project: Project | None = None,
) -> Notification:
    if issue is not None:
        issue_project = getattr(issue, "project", None)
        if issue_project is None:
            raise ValidationError({"issue": "Issue must belong to a project"})
        if project is None:
            project = issue_project
        elif getattr(project, "project_id", None) != getattr(issue_project, "project_id", None):
            raise ValidationError({"project": "Project must match the issue project"})

    notification = Notification.objects.create(notify_type=notify_type, issue=issue, project=project)
    NotifyUser.objects.bulk_create(
        [NotifyUser(notification=notification, user=user) for user in users],
        ignore_conflicts=True,
    )
    return notification
