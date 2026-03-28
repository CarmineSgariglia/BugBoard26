from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q

from ..issues.models import Issue
from ..projects.models import Project

# Model to represent the type of notification, with predefined choices for different events that can trigger notifications
class NotifyType(models.TextChoices):
    PROJECT_ADDED = "PROJECT_ADDED", "Project Added"
    PROJECT_ASSIGNED = "PROJECT_ASSIGNED", "Project Assigned"
    PROJECT_REMOVED = "PROJECT_REMOVED", "Project Removed"
    PROJECT_UNASSIGNED = "PROJECT_UNASSIGNED", "Project Unassigned"
    ISSUE_ASSIGNED = "ISSUE_ASSIGNED", "Issue Assigned"
    ISSUE_ADDED = "ISSUE_ADDED", "Issue Added"
    ISSUE_CLOSED = "ISSUE_CLOSED", "Issue Closed"
    ISSUE_UNASSIGNED = "ISSUE_UNASSIGNED", "Issue Unassigned"
    ISSUE_UPDATED = "ISSUE_UPDATED", "Issue Updated"

# Model to represent a Notification, which can be associated with either an Issue or a Project (but not both), and includes fields for the type of notification, timestamps, and relationships to the relevant Issue or Project. 
class Notification(models.Model):
    notification_id = models.AutoField(primary_key=True, db_column="notificationId")
    notify_type = models.CharField(max_length=32, choices=NotifyType.choices, db_column="type")
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, null=True, blank=True, db_column="issueId", related_name="notifications")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, db_column="projectId", related_name="notifications")
    users = models.ManyToManyField(User, through="NotifyUser", related_name="notification_users")
    created_at = models.DateTimeField(auto_now_add=True, db_column="createdAt")

    class Meta:
        db_table = "Notification"
        
        ordering = ["-created_at"]

# Intermediate table to manage the many-to-many relationship between Notification and User, with fields to track read status and timestamp of when the notification was read
class NotifyUser(models.Model):
    notify_user_id = models.AutoField(primary_key=True, db_column="notifyUserId")
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, db_column="notificationId", related_name="recipients")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="notifications")
    is_read = models.BooleanField(default=False, db_column="isRead")
    read_at = models.DateTimeField(null=True, blank=True, db_column="readAt")

    class Meta:
        db_table = "NotifyUser"
        constraints = [models.UniqueConstraint(fields=["notification", "user"], name="unique_notification_user")]
        indexes = [models.Index(fields=["user", "notify_user_id"], name="notifyuser_user_id_idx")]
        ordering = ["-notification__created_at"]
