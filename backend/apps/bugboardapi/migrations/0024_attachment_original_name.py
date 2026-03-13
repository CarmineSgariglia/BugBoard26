from pathlib import PurePosixPath

from django.db import migrations, models


def backfill_attachment_original_name(apps, schema_editor):
    Attachment = apps.get_model("bugboardapi", "Attachment")

    for attachment in Attachment.objects.all().only("attachment_id", "path", "original_name"):
        if attachment.original_name:
            continue
        fallback_name = PurePosixPath((attachment.path or "").replace("\\", "/")).name
        attachment.original_name = fallback_name or "attachment"
        attachment.save(update_fields=["original_name"])


class Migration(migrations.Migration):

    dependencies = [
        ("bugboardapi", "0023_alter_issueevent_message"),
    ]

    operations = [
        migrations.AddField(
            model_name="attachment",
            name="original_name",
            field=models.CharField(db_column="originalName", default="", max_length=256),
        ),
        migrations.RunPython(backfill_attachment_original_name, migrations.RunPython.noop),
    ]
