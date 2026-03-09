"""Management command to seed sample notifications for development."""
import random

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from apps.bugboardapi.models import Issue, Notification, NotifyType, NotifyUser, Project


class Command(BaseCommand):
    help = "Create sample notifications for the first active user (development only)"

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=5, help="Number of notifications to create")

    def handle(self, *args, **options):
        count = options["count"]
        user = User.objects.filter(is_active=True).first()
        if not user:
            self.stderr.write(self.style.ERROR("No active user found."))
            return

        projects = list(Project.objects.all()[:5])
        issues = list(Issue.objects.all()[:5])

        self.stdout.write(f"Creating {count} notifications for user: {user.username}")

        for i in range(count):
            notify_type = random.choice([t[0] for t in NotifyType.choices])

            project = None
            issue = None

            if notify_type in [NotifyType.PROJECT_ADDED, NotifyType.PROJECT_REMOVED]:
                if projects:
                    project = random.choice(projects)
            else:
                if issues:
                    issue = random.choice(issues)
                elif projects:
                    if not issues:
                        issue = Issue.objects.create(
                            project=projects[0],
                            reporter=user,
                            title="Dummy Issue for Notification",
                            description="Created by seeder",
                        )
                        issues.append(issue)

            if not project and not issue:
                if projects:
                    project = projects[0]
                else:
                    project = Project.objects.create(name=f"Dummy Project {i}", description="Seeded", created_by=user)
                    projects.append(project)
                notify_type = NotifyType.PROJECT_ADDED

            notif = Notification.objects.create(
                notify_type=notify_type,
                project=project,
                issue=issue,
            )
            NotifyUser.objects.create(notification=notif, user=user, is_read=False)
            self.stdout.write(f"  Created {notify_type} notification.")

        self.stdout.write(self.style.SUCCESS(f"Done: {count} notifications created."))
