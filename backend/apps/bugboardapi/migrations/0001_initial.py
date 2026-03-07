from django.conf import settings
from django.core import validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Issue",
            fields=[
                ("issue_id", models.AutoField(db_column="issueId", primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=30)),
                ("description", models.CharField(max_length=256)),
                (
                    "issue_type",
                    models.CharField(
                        choices=[
                            ("QUESTION", "Question"),
                            ("BUG", "Bug"),
                            ("DOCUMENTATION", "Documentation"),
                            ("FEATURE", "Feature"),
                        ],
                        db_column="type",
                        default="BUG",
                        max_length=32,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("TODO", "To Do"),
                            ("IN_PROGRESS", "In Progress"),
                            ("DONE", "Done"),
                            ("CANCELLED", "Cancelled"),
                        ],
                        default="TODO",
                        max_length=32,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[("LOW", "Low"), ("MEDIUM", "Medium"), ("HIGH", "High"), ("CRITICAL", "Critical")],
                        default="MEDIUM",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_column="createdAt")),
                ("updated_at", models.DateTimeField(auto_now=True, db_column="updatedAt")),
                ("closed_at", models.DateTimeField(blank=True, db_column="closedAt", null=True)),
            ],
            options={"db_table": "Issue", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="IssueEvent",
            fields=[
                ("update_id", models.AutoField(db_column="updateId", primary_key=True, serialize=False)),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("CREATE", "Create"),
                            ("EDIT", "Edit"),
                            ("STATUS_CHANGE", "Status Change"),
                            ("ASSIGN", "Assign"),
                            ("UNASSIGN", "Unassign"),
                            ("COMMENT", "Comment"),
                        ],
                        db_column="eventType",
                        max_length=32,
                    ),
                ),
                ("at", models.DateTimeField(auto_now_add=True)),
                ("message", models.CharField(blank=True, default="", max_length=256)),
                (
                    "old_status",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("TODO", "To Do"),
                            ("IN_PROGRESS", "In Progress"),
                            ("DONE", "Done"),
                            ("CANCELLED", "Cancelled"),
                        ],
                        db_column="oldStatus",
                        default="",
                        max_length=32,
                    ),
                ),
                (
                    "new_status",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("TODO", "To Do"),
                            ("IN_PROGRESS", "In Progress"),
                            ("DONE", "Done"),
                            ("CANCELLED", "Cancelled"),
                        ],
                        db_column="newStatus",
                        default="",
                        max_length=32,
                    ),
                ),
                (
                    "actor",
                    models.ForeignKey(
                        db_column="actorId",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="issue_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "issue",
                    models.ForeignKey(
                        db_column="issueId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="events",
                        to="bugboardapi.issue",
                    ),
                ),
            ],
            options={"db_table": "IssueEvent", "ordering": ["-at"]},
        ),
        migrations.CreateModel(
            name="PasswordResetOTP",
            fields=[
                ("otp_id", models.AutoField(db_column="otpId", primary_key=True, serialize=False)),
                (
                    "code",
                    models.CharField(
                        max_length=6,
                        validators=[validators.MinLengthValidator(6), validators.RegexValidator("^\\d{6}$", "OTP must be 6 digits")],
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_column="createdAt")),
                ("expires_at", models.DateTimeField(db_column="expiresAt")),
                ("is_used", models.BooleanField(db_column="isUsed", default=False)),
                (
                    "user",
                    models.ForeignKey(
                        db_column="userId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="otp_codes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "PasswordResetOTP", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Project",
            fields=[
                ("project_id", models.AutoField(db_column="projectId", primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=30, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_column="createdAt")),
                ("description", models.CharField(max_length=256)),
                ("color", models.CharField(blank=True, default="", max_length=9)),
                ("icon", models.CharField(blank=True, default="", max_length=256)),
                (
                    "created_by",
                    models.ForeignKey(
                        db_column="createdBy",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_projects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "Project", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Tag",
            fields=[
                ("tag_id", models.AutoField(db_column="tagId", primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=16, unique=True)),
            ],
            options={"db_table": "Tag", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                (
                    "user",
                    models.OneToOneField(
                        db_column="userId",
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="profile",
                        serialize=False,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("is_admin", models.BooleanField(db_column="isAdmin", default=False)),
                ("profile_img", models.CharField(blank=True, db_column="profileImg", default="", max_length=256)),
                ("active", models.BooleanField(db_column="active", default=True)),
            ],
            options={"db_table": "Users"},
        ),
        migrations.CreateModel(
            name="ProjectMembership",
            fields=[
                ("project_membership_id", models.AutoField(db_column="projectMembershipId", primary_key=True, serialize=False)),
                (
                    "role",
                    models.CharField(
                        choices=[("admin", "Admin"), ("developer", "Developer")],
                        default="developer",
                        max_length=16,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        db_column="projectId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="bugboardapi.project",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        db_column="userId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "ProjectMembership"},
        ),
        migrations.AddField(
            model_name="issue",
            name="project",
            field=models.ForeignKey(
                db_column="projectId",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="issues",
                to="bugboardapi.project",
            ),
        ),
        migrations.AddField(
            model_name="issue",
            name="reporter",
            field=models.ForeignKey(
                db_column="reporterId",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="reported_issues",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("notification_id", models.AutoField(db_column="notificationId", primary_key=True, serialize=False)),
                (
                    "notify_type",
                    models.CharField(
                        choices=[
                            ("PROJECT_ADDED", "Project Added"),
                            ("PROJECT_REMOVED", "Project Removed"),
                            ("ISSUE_ASSIGNED", "Issue Assigned"),
                            ("ISSUE_UPDATED", "Issue Updated"),
                            ("ISSUE_CLOSED", "Issue Closed"),
                            ("ISSUE_UNASSIGNED", "Issue Unassigned"),
                        ],
                        db_column="type",
                        max_length=32,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_column="createdAt")),
                (
                    "issue",
                    models.ForeignKey(
                        blank=True,
                        db_column="issueId",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="bugboardapi.issue",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        blank=True,
                        db_column="projectId",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="bugboardapi.project",
                    ),
                ),
            ],
            options={"db_table": "Notification", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="NotifyUser",
            fields=[
                ("notify_user_id", models.AutoField(db_column="notifyUserId", primary_key=True, serialize=False)),
                ("is_read", models.BooleanField(db_column="isRead", default=False)),
                ("read_at", models.DateTimeField(blank=True, db_column="readAt", null=True)),
                (
                    "notification",
                    models.ForeignKey(
                        db_column="notificationId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recipients",
                        to="bugboardapi.notification",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        db_column="userId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "NotifyUser", "ordering": ["-notification__created_at"]},
        ),
        migrations.CreateModel(
            name="IssueAssignee",
            fields=[
                ("issue_assignee_id", models.AutoField(db_column="issueAssigneeId", primary_key=True, serialize=False)),
                (
                    "issue",
                    models.ForeignKey(
                        db_column="issueId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="issue_assignees",
                        to="bugboardapi.issue",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        db_column="userId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="issue_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "IssueAssignee"},
        ),
        migrations.CreateModel(
            name="IssueTag",
            fields=[
                ("issue_tag_id", models.AutoField(db_column="issueTagId", primary_key=True, serialize=False)),
                (
                    "issue",
                    models.ForeignKey(
                        db_column="issueId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="issue_tags",
                        to="bugboardapi.issue",
                    ),
                ),
                (
                    "tag",
                    models.ForeignKey(
                        db_column="tagId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tag_issues",
                        to="bugboardapi.tag",
                    ),
                ),
            ],
            options={"db_table": "IssueTag"},
        ),
        migrations.CreateModel(
            name="Attachment",
            fields=[
                ("attachment_id", models.AutoField(db_column="attachmentId", primary_key=True, serialize=False)),
                ("path", models.CharField(max_length=256)),
                ("mime_type", models.CharField(db_column="mimeType", max_length=50)),
                ("size", models.IntegerField()),
                ("uploaded_at", models.DateTimeField(auto_now_add=True, db_column="uploadedAt")),
                (
                    "update",
                    models.ForeignKey(
                        db_column="updateId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attachments",
                        to="bugboardapi.issueevent",
                    ),
                ),
            ],
            options={"db_table": "Attachment"},
        ),
        migrations.AddConstraint(
            model_name="projectmembership",
            constraint=models.UniqueConstraint(fields=("project", "user"), name="unique_project_user_membership"),
        ),
        migrations.AddConstraint(
            model_name="issuetag",
            constraint=models.UniqueConstraint(fields=("issue", "tag"), name="unique_issue_tag"),
        ),
        migrations.AddConstraint(
            model_name="issueassignee",
            constraint=models.UniqueConstraint(fields=("issue", "user"), name="unique_issue_assignee"),
        ),
        migrations.AddConstraint(
            model_name="notifyuser",
            constraint=models.UniqueConstraint(fields=("notification", "user"), name="unique_notification_user"),
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.CheckConstraint(
                check=(models.Q(("issue__isnull", False), ("project__isnull", True)) | models.Q(("issue__isnull", True), ("project__isnull", False))),
                name="notification_xor_target",
            ),
        ),
        migrations.AddIndex(
            model_name="passwordresetotp",
            index=models.Index(fields=["user", "code", "is_used", "expires_at"], name="otp_lookup_idx"),
        ),
    ]
