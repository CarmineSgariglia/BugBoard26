from django.db import migrations, models


def normalize_legacy_notification_types(apps, schema_editor):
    Notification = apps.get_model("bugboardapi", "Notification")

    Notification.objects.filter(notify_type="PROJECT_ADDED").update(
        notify_type="PROJECT_ASSIGNED"
    )
    Notification.objects.filter(notify_type="UNASSIGNED_PROJECT").update(
        notify_type="PROJECT_UNASSIGNED"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("bugboardapi", "0026_user_email_ci_unique"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="notify_type",
            field=models.CharField(
                choices=[
                    ("PROJECT_ADDED", "Project Added"),
                    ("PROJECT_ASSIGNED", "Project Assigned"),
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
        migrations.RunPython(
            normalize_legacy_notification_types,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
