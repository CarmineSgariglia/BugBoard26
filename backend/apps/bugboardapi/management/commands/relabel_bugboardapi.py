from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Relabel Django migration/content-type metadata from core to bugboardapi"

    def handle(self, *args, **options):
        table_names = set(connection.introspection.table_names())
        migrations_updated = 0
        content_types_updated = 0

        with connection.cursor() as cursor:
            if "django_migrations" in table_names:
                cursor.execute("UPDATE django_migrations SET app = %s WHERE app = %s", ["bugboardapi", "core"])
                migrations_updated = cursor.rowcount
            if "django_content_type" in table_names:
                cursor.execute("UPDATE django_content_type SET app_label = %s WHERE app_label = %s", ["bugboardapi", "core"])
                content_types_updated = cursor.rowcount

        self.stdout.write(
            self.style.SUCCESS(
                f"Relabel complete: django_migrations={migrations_updated}, django_content_type={content_types_updated}"
            )
        )
