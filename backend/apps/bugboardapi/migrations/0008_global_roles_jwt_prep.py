from django.db import migrations


ADMIN_GROUP_NAME = "admin"
DEVELOPER_GROUP_NAME = "developer"


def forwards(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    User = apps.get_model("auth", "User")
    UserProfile = apps.get_model("bugboardapi", "UserProfile")

    admin_group, _ = Group.objects.get_or_create(name=ADMIN_GROUP_NAME)
    developer_group, _ = Group.objects.get_or_create(name=DEVELOPER_GROUP_NAME)

    for user in User.objects.all():
        profile = UserProfile.objects.filter(user_id=user.id).first()
        is_admin = bool(user.is_superuser or user.is_staff or (profile and profile.is_admin))
        user.groups.set([admin_group if is_admin else developer_group])

        desired_is_staff = bool(user.is_superuser or is_admin)
        if user.is_staff != desired_is_staff:
            user.is_staff = desired_is_staff
            user.save(update_fields=["is_staff"])

        if profile:
            profile.is_admin = is_admin
            profile.active = user.is_active
            profile.save(update_fields=["is_admin", "active"])


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("token_blacklist", "0012_alter_outstandingtoken_user"),
        ("bugboardapi", "0007_delete_issueimage"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
