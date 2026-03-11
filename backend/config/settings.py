import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key-change-me")

DEBUG = os.getenv("DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,backend").split(",")
    if host.strip()
]

if not DEBUG and SECRET_KEY == "dev-secret-key-change-me":
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "apps.bugboardapi",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
APPEND_SLASH = False

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "bugboard"),
        "USER": os.getenv("DB_USER", "bugboard"),
        "PASSWORD": os.getenv("DB_PASSWORD", "bugboard"),
        "HOST": os.getenv("DB_HOST", "db"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Rome"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

def _csv_env(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "False").lower() == "true"
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "True").lower() == "true"
CORS_ALLOWED_ORIGINS = _csv_env("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

if not DEBUG and CORS_ALLOW_ALL_ORIGINS:
    raise ImproperlyConfigured("CORS_ALLOW_ALL_ORIGINS=True is not allowed in production")

csrf_origins = set(_csv_env("CSRF_TRUSTED_ORIGINS", ""))
csrf_origins.update(CORS_ALLOWED_ORIGINS)
csrf_origins.update(_csv_env("CSRF_TRUSTED_ORIGINS_EXTRA", ""))

# Dev convenience for Docker/Vite local networking.
# Keep this block debug-only to avoid weakening production posture.
if DEBUG:
    csrf_origins.update(
        {
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://172.21.160.1:5173",
            "https://localhost",
            "https://127.0.0.1",
        }
    )

CSRF_TRUSTED_ORIGINS = sorted(csrf_origins)

SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", str(not DEBUG)).lower() == "true"
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", str(not DEBUG)).lower() == "true"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_AGE = int(os.getenv("SESSION_COOKIE_AGE_SECONDS", "28800"))
SESSION_SAVE_EVERY_REQUEST = os.getenv("SESSION_SAVE_EVERY_REQUEST", "True").lower() == "true"
SESSION_EXPIRE_AT_BROWSER_CLOSE = os.getenv("SESSION_EXPIRE_AT_BROWSER_CLOSE", "False").lower() == "true"

SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", str(not DEBUG)).lower() == "true"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = os.getenv("USE_X_FORWARDED_HOST", "True").lower() == "true"

SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv("SECURE_HSTS_INCLUDE_SUBDOMAINS", str(not DEBUG)).lower() == "true"
SECURE_HSTS_PRELOAD = os.getenv("SECURE_HSTS_PRELOAD", str(not DEBUG)).lower() == "true"

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "strict-origin-when-cross-origin")

MEDIA_STORAGE_BACKEND = os.getenv("MEDIA_STORAGE_BACKEND", "local").lower()
if MEDIA_STORAGE_BACKEND not in {"local", "gcs"}:
    raise ImproperlyConfigured("MEDIA_STORAGE_BACKEND must be one of: local, gcs")

if MEDIA_STORAGE_BACKEND == "gcs":
    GS_BUCKET_NAME = os.getenv("GS_BUCKET_NAME", "").strip()
    if not GS_BUCKET_NAME:
        raise ImproperlyConfigured("GS_BUCKET_NAME must be set when MEDIA_STORAGE_BACKEND=gcs")

    GS_DEFAULT_ACL = None
    GS_QUERYSTRING_AUTH = os.getenv("GS_QUERYSTRING_AUTH", "False").lower() == "true"
    MEDIA_URL = os.getenv("GCS_MEDIA_URL", f"https://storage.googleapis.com/{GS_BUCKET_NAME}/")
    if not MEDIA_URL.endswith("/"):
        MEDIA_URL = f"{MEDIA_URL}/"
    STORAGES = {
        "default": {"BACKEND": "storages.backends.gcloud.GoogleCloudStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.bugboardapi.authentication.RevocableJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "300/min",
        "login": "20/min",
        "otp": "10/min",
    },
}

AUTH_REFRESH_COOKIE_NAME = os.getenv("AUTH_REFRESH_COOKIE_NAME", "bugboard_refresh")
AUTH_REFRESH_COOKIE_PATH = os.getenv("AUTH_REFRESH_COOKIE_PATH", "/api/auth")
AUTH_REFRESH_COOKIE_SECURE = os.getenv("AUTH_REFRESH_COOKIE_SECURE", str(not DEBUG)).lower() == "true"
AUTH_REFRESH_COOKIE_SAMESITE = os.getenv("AUTH_REFRESH_COOKIE_SAMESITE", "Lax")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "console").lower()
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_OTP_TEMPLATE_ID = os.getenv("BREVO_OTP_TEMPLATE_ID", "")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "")

if EMAIL_PROVIDER == "brevo":
    EMAIL_BACKEND = "anymail.backends.brevo.EmailBackend"
    ANYMAIL = {
        "BREVO_API_KEY": BREVO_API_KEY,
    }
else:
    EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@bugboard26.local")

BUGBOARD_MAX_PROFILE_IMAGE_BYTES = int(os.getenv("BUGBOARD_MAX_PROFILE_IMAGE_BYTES", str(2 * 1024 * 1024)))
BUGBOARD_MAX_ATTACHMENT_IMAGE_BYTES = int(os.getenv("BUGBOARD_MAX_ATTACHMENT_IMAGE_BYTES", str(10 * 1024 * 1024)))
BUGBOARD_MAX_ATTACHMENT_FILE_BYTES = int(os.getenv("BUGBOARD_MAX_ATTACHMENT_FILE_BYTES", str(10 * 1024 * 1024)))
BUGBOARD_MAX_ATTACHMENT_VIDEO_BYTES = int(os.getenv("BUGBOARD_MAX_ATTACHMENT_VIDEO_BYTES", str(50 * 1024 * 1024)))
BUGBOARD_VIDEO_OUTPUT_MAX_BYTES = int(os.getenv("BUGBOARD_VIDEO_OUTPUT_MAX_BYTES", str(50 * 1024 * 1024)))
