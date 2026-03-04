from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_alter_issue_description"),
    ]

    operations = [
        migrations.CreateModel(
            name="IssueImage",
            fields=[
                ("issue_image_id", models.AutoField(db_column="issueImageId", primary_key=True, serialize=False)),
                ("path", models.CharField(max_length=256)),
                (
                    "issue",
                    models.ForeignKey(
                        db_column="issueId",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="images",
                        to="core.issue",
                    ),
                ),
            ],
            options={"db_table": "IssueImage"},
        ),
        migrations.AlterField(
            model_name="attachment",
            name="update",
            field=models.ForeignKey(
                db_column="updateId",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="attachments",
                to="core.issueevent",
            ),
        ),
        migrations.AlterField(
            model_name="notification",
            name="notify_type",
            field=models.CharField(
                choices=[
                    ("PROJECT_ADDED", "Project Added"),
                    ("PROJECT_REMOVED", "Project Removed"),
                    ("ISSUE_ASSIGNED", "Issue Assigned"),
                    ("ISSUE_ADDED", "Issue Added"),
                    ("ISSUE_CLOSED", "Issue Closed"),
                    ("ISSUE_UNASSIGNED", "Issue Unassigned"),
                    ("ISSUE_UPDATED", "Issue Updated"),
                ],
                db_column="type",
                max_length=32,
            ),
        ),
    ]
