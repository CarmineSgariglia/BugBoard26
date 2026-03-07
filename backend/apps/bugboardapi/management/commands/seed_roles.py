from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

from apps.bugboardapi.roles import ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME


class Command(BaseCommand):
    help = "Create admin and developer groups with baseline permissions"

    def handle(self, *args, **options):
        admin_group, _ = Group.objects.get_or_create(name=ADMIN_GROUP_NAME)
        dev_group, _ = Group.objects.get_or_create(name=DEVELOPER_GROUP_NAME)

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

        self.stdout.write(self.style.SUCCESS(f"Groups seeded: {ADMIN_GROUP_NAME}, {DEVELOPER_GROUP_NAME}"))
