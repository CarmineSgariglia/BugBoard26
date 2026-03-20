from . import settings as base_settings 
for setting_name in dir(base_settings):
    if setting_name.isupper():
        globals()[setting_name] = getattr(base_settings, setting_name)


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": base_settings.BASE_DIR / "test_db.sqlite3",
    }
}

MIGRATION_MODULES = {
    "bugboardapi": None,
}
