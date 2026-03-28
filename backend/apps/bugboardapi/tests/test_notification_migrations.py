from django.db import connection
from django.test import TransactionTestCase
from django.db.migrations.executor import MigrationExecutor


class NotificationTypeMigrationTests(TransactionTestCase):
    migrate_from = ("bugboardapi", "0026_user_email_ci_unique")
    migrate_to = ("bugboardapi", "0027_notification_type_project_assigned")

    def setUp(self):
        super().setUp()
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_from])
        old_apps = self.executor.loader.project_state([self.migrate_from]).apps

        User = old_apps.get_model("auth", "User")
        Project = old_apps.get_model("bugboardapi", "Project")
        Issue = old_apps.get_model("bugboardapi", "Issue")
        Notification = old_apps.get_model("bugboardapi", "Notification")

        user = User.objects.create(username="legacy_notify_user")
        project = Project.objects.create(
            name="Legacy notification project",
            description="legacy",
            color="#123456",
            icon="folder",
            created_by=user,
        )
        issue = Issue.objects.create(
            project=project,
            reporter=user,
            title="Legacy issue",
            description="legacy issue",
            issue_type="BUG",
            status="TODO",
            priority="MEDIUM",
        )

        Notification.objects.create(notify_type="PROJECT_ADDED", project=project)
        Notification.objects.create(notify_type="UNASSIGNED_PROJECT", project=project)
        Notification.objects.create(
            notify_type="ISSUE_ADDED",
            issue=issue,
            project=project,
        )

        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_to])
        self.apps = self.executor.loader.project_state([self.migrate_to]).apps

    def test_migration_normalizes_legacy_notification_types(self):
        Notification = self.apps.get_model("bugboardapi", "Notification")

        self.assertEqual(
            list(
                Notification.objects.order_by("notification_id").values_list(
                    "notify_type",
                    flat=True,
                )
            ),
            [
                "PROJECT_ASSIGNED",
                "PROJECT_UNASSIGNED",
                "ISSUE_ADDED",
            ],
        )

        self.assertIn(
            ("PROJECT_ASSIGNED", "Project Assigned"),
            Notification._meta.get_field("notify_type").choices,
        )
