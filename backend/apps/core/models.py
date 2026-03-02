from datetime import timedelta

from django.contrib.auth.models import User
from django.core.validators import MinLengthValidator, RegexValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        primary_key=True,
        db_column="userId",
        related_name="profile",
    )
    is_admin = models.BooleanField(default=False, db_column="isAdmin")
    profile_img = models.CharField(max_length=256, blank=True, default="", db_column="profileImg")
    active = models.BooleanField(default=True, db_column="active")

    class Meta:
        db_table = "Users"

    def __str__(self) -> str:
        return self.user.username


class IssueType(models.TextChoices):
    QUESTION = "QUESTION", "Question"
    BUG = "BUG", "Bug"
    DOCUMENTATION = "DOCUMENTATION", "Documentation"
    FEATURE = "FEATURE", "Feature"


class IssueStatus(models.TextChoices):
    TODO = "TODO", "To Do"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    DONE = "DONE", "Done"
    CANCELLED = "CANCELLED", "Cancelled"


class Priority(models.TextChoices):
    LOW = "LOW", "Low"
    MEDIUM = "MEDIUM", "Medium"
    HIGH = "HIGH", "High"
    URGENT = "URGENT", "Urgent"


class NotifyType(models.TextChoices):
    PROJECT_ADDED = "PROJECT_ADDED", "Project Added"
    PROJECT_REMOVED = "PROJECT_REMOVED", "Project Removed"
    ISSUE_ASSIGNED = "ISSUE_ASSIGNED", "Issue Assigned"
    ISSUE_UPDATED = "ISSUE_UPDATED", "Issue Updated"
    ISSUE_CLOSED = "ISSUE_CLOSED", "Issue Closed"
    ISSUE_UNASSIGNED = "ISSUE_UNASSIGNED", "Issue Unassigned"


class EventType(models.TextChoices):
    CREATE = "CREATE", "Create"
    EDIT = "EDIT", "Edit"
    STATUS_CHANGE = "STATUS_CHANGE", "Status Change"
    ASSIGN = "ASSIGN", "Assign"
    UNASSIGN = "UNASSIGN", "Unassign"
    COMMENT = "COMMENT", "Comment"


class Project(models.Model):
    project_id = models.AutoField(primary_key=True, db_column="projectId")
    name = models.CharField(max_length=30, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, db_column="createdAt")
    description = models.CharField(max_length=256)
    color = models.CharField(max_length=9, blank=True, default="")
    icon = models.CharField(max_length=256, blank=True, default="")
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        db_column="createdBy",
        related_name="created_projects",
    )

    class Meta:
        db_table = "Project"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class ProjectMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        DEVELOPER = "developer", "Developer"

    project_membership_id = models.AutoField(primary_key=True, db_column="projectMembershipId")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, db_column="projectId", related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="project_memberships")
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.DEVELOPER)

    class Meta:
        db_table = "ProjectMembership"
        constraints = [models.UniqueConstraint(fields=["project", "user"], name="unique_project_user_membership")]


class Tag(models.Model):
    tag_id = models.AutoField(primary_key=True, db_column="tagId")
    name = models.CharField(max_length=16, unique=True)

    class Meta:
        db_table = "Tag"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Issue(models.Model):
    issue_id = models.AutoField(primary_key=True, db_column="issueId")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, db_column="projectId", related_name="issues")
    reporter = models.ForeignKey(User, on_delete=models.PROTECT, db_column="reporterId", related_name="reported_issues")
    title = models.CharField(max_length=30)
    description = models.CharField(max_length=256)
    issue_type = models.CharField(max_length=32, choices=IssueType.choices, default=IssueType.BUG, db_column="type")
    status = models.CharField(max_length=32, choices=IssueStatus.choices, default=IssueStatus.TODO)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    created_at = models.DateTimeField(auto_now_add=True, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")
    closed_at = models.DateTimeField(null=True, blank=True, db_column="closedAt")
    assignees = models.ManyToManyField(User, through="IssueAssignee", related_name="assigned_issues")
    tags = models.ManyToManyField(Tag, through="IssueTag", related_name="issues")

    class Meta:
        db_table = "Issue"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class IssueAssignee(models.Model):
    issue_assignee_id = models.AutoField(primary_key=True, db_column="issueAssigneeId")
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, db_column="issueId", related_name="issue_assignees")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="issue_assignments")

    class Meta:
        db_table = "IssueAssignee"
        constraints = [models.UniqueConstraint(fields=["issue", "user"], name="unique_issue_assignee")]


class IssueTag(models.Model):
    issue_tag_id = models.AutoField(primary_key=True, db_column="issueTagId")
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, db_column="issueId", related_name="issue_tags")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, db_column="tagId", related_name="tag_issues")

    class Meta:
        db_table = "IssueTag"
        constraints = [models.UniqueConstraint(fields=["issue", "tag"], name="unique_issue_tag")]


class IssueEvent(models.Model):
    update_id = models.AutoField(primary_key=True, db_column="updateId")
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, db_column="issueId", related_name="events")
    actor = models.ForeignKey(User, on_delete=models.PROTECT, db_column="actorId", related_name="issue_events")
    event_type = models.CharField(max_length=32, choices=EventType.choices, db_column="eventType")
    at = models.DateTimeField(auto_now_add=True)
    message = models.CharField(max_length=256, blank=True, default="")
    old_status = models.CharField(
        max_length=32,
        choices=IssueStatus.choices,
        blank=True,
        default="",
        db_column="oldStatus",
    )
    new_status = models.CharField(
        max_length=32,
        choices=IssueStatus.choices,
        blank=True,
        default="",
        db_column="newStatus",
    )

    class Meta:
        db_table = "IssueEvent"
        ordering = ["-at"]


class Attachment(models.Model):
    attachment_id = models.AutoField(primary_key=True, db_column="attachmentId")
    update = models.ForeignKey(IssueEvent, on_delete=models.CASCADE, db_column="updateId", related_name="attachments")
    path = models.CharField(max_length=256)
    mime_type = models.CharField(max_length=50, db_column="mimeType")
    size = models.IntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True, db_column="uploadedAt")

    class Meta:
        db_table = "Attachment"


class Notification(models.Model):
    notification_id = models.AutoField(primary_key=True, db_column="notificationId")
    notify_type = models.CharField(max_length=32, choices=NotifyType.choices, db_column="type")
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, null=True, blank=True, db_column="issueId", related_name="notifications")
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        db_column="projectId",
        related_name="notifications",
    )
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
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        db_column="notificationId",
        related_name="recipients",
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="notifications")
    is_read = models.BooleanField(default=False, db_column="isRead")
    read_at = models.DateTimeField(null=True, blank=True, db_column="readAt")

    class Meta:
        db_table = "NotifyUser"
        constraints = [models.UniqueConstraint(fields=["notification", "user"], name="unique_notification_user")]
        ordering = ["-notification__created_at"]


class PasswordResetOTP(models.Model):
    otp_id = models.AutoField(primary_key=True, db_column="otpId")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="otp_codes")
    code = models.CharField(
        max_length=6,
        validators=[MinLengthValidator(6), RegexValidator(r"^\d{6}$", "OTP must be 6 digits")],
    )
    created_at = models.DateTimeField(auto_now_add=True, db_column="createdAt")
    expires_at = models.DateTimeField(db_column="expiresAt")
    is_used = models.BooleanField(default=False, db_column="isUsed")

    class Meta:
        db_table = "PasswordResetOTP"
        indexes = [
            models.Index(fields=["user", "code", "is_used", "expires_at"], name="otp_lookup_idx"),
        ]
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=5)
        super().save(*args, **kwargs)

    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() <= self.expires_at
