from django.apps import AppConfig


class BugBoardAPIConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.bugboardapi"
    label = "bugboardapi"
    verbose_name = "BugBoardAPI"

    def ready(self):
        from .api import openapi  # noqa: F401
