from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("bugboardapi", "0013_remove_userimage_active_remove_userimage_is_admin"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="UserImage",
            new_name="UserProfileImage",
        ),
    ]
