from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bugboardapi", "0021_remove_notification_notification_xor_target_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="notify_type",
            field=models.CharField(
                choices=[
                    ("PROJECT_ADDED", "Project Added"),
                    ("PROJECT_REMOVED", "Project Removed"),
                    ("PROJECT_UNASSIGNED", "Project Unassigned"),
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
