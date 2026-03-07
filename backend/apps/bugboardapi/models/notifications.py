from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q

from .issues import Issue
from .projects import Project


class NotifyType(models.TextChoices):
    PROJECT_ADDED = "PROJECT_ADDED", "Project Added"
    PROJECT_REMOVED = "PROJECT_REMOVED", "Project Removed"
    ISSUE_ASSIGNED = "ISSUE_ASSIGNED", "Issue Assigned"
    ISSUE_ADDED = "ISSUE_ADDED", "Issue Added"
    ISSUE_CLOSED = "ISSUE_CLOSED", "Issue Closed"
    ISSUE_UNASSIGNED = "ISSUE_UNASSIGNED", "Issue Unassigned"
    ISSUE_UPDATED = "ISSUE_UPDATED", "Issue Updated"


class Notification(models.Model):
    notification_id = models.AutoField(primary_key=True, db_column="notificationId")
    notify_type = models.CharField(max_length=32, choices=NotifyType.choices, db_column="type")
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, null=True, blank=True, db_column="issueId", related_name="notifications")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, db_column="projectId", related_name="notifications")
    created_at = models.DateTimeField(auto_now_add=True, db_column="createdAt")

    class Meta:
        db_table = "Notification"
        constraints = [
            models.CheckConstraint(
                check=(Q(issue__isnull=False, project__isnull=True) | Q(issue__isnull=True, project__isnull=False)),
                name="notification_xor_target",
            )
        ]
        ordering = ["-created_at"]


class NotifyUser(models.Model):
    notify_user_id = models.AutoField(primary_key=True, db_column="notifyUserId")
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, db_column="notificationId", related_name="recipients")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="notifications")
    is_read = models.BooleanField(default=False, db_column="isRead")
    read_at = models.DateTimeField(null=True, blank=True, db_column="readAt")

    class Meta:
        db_table = "NotifyUser"
        constraints = [models.UniqueConstraint(fields=["notification", "user"], name="unique_notification_user")]
        ordering = ["-notification__created_at"]
