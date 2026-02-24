from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create APP_ADMIN and DEVELOPER groups with baseline permissions"

    def handle(self, *args, **options):
        admin_group, _ = Group.objects.get_or_create(name="APP_ADMIN")
        dev_group, _ = Group.objects.get_or_create(name="DEVELOPER")

        all_permissions = Permission.objects.all()
        admin_group.permissions.set(all_permissions)

        dev_codenames = [
            "view_project",
            "view_issue",
            "add_issue",
            "change_issue",
            "view_issueevent",
            "add_issueevent",
            "view_notification",
            "view_notifyuser",
            "change_notifyuser",
            "view_tag",
        ]
        dev_permissions = Permission.objects.filter(codename__in=dev_codenames)
        dev_group.permissions.set(dev_permissions)

        self.stdout.write(self.style.SUCCESS("Groups seeded: APP_ADMIN, DEVELOPER"))
