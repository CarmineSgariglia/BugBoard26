from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bugboardapi", "0024_attachment_original_name"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="notifyuser",
            index=models.Index(fields=["user", "notify_user_id"], name="notifyuser_user_id_idx"),
        ),
    ]
