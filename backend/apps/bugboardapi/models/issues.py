from django.contrib.auth.models import User
from django.db import models

from .projects import Project
from .tags import Tag


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


class EventType(models.TextChoices):
    CREATE = "CREATE", "Create"
    EDIT = "EDIT", "Edit"
    STATUS_CHANGE = "STATUS_CHANGE", "Status Change"
    ASSIGN = "ASSIGN", "Assign"
    UNASSIGN = "UNASSIGN", "Unassign"
    COMMENT = "COMMENT", "Comment"


class Issue(models.Model):
    issue_id = models.AutoField(primary_key=True, db_column="issueId")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, db_column="projectId", related_name="issues")
    reporter = models.ForeignKey(User, on_delete=models.PROTECT, db_column="reporterId", related_name="reported_issues")
    title = models.CharField(max_length=30)
    description = models.CharField(max_length=1000)
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
    old_status = models.CharField(max_length=32, choices=IssueStatus.choices, blank=True, default="", db_column="oldStatus")
    new_status = models.CharField(max_length=32, choices=IssueStatus.choices, blank=True, default="", db_column="newStatus")

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
