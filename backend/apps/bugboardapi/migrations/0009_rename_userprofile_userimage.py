from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("bugboardapi", "0008_global_roles_jwt_prep"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="UserProfile",
            new_name="UserImage",
        ),
    ]
