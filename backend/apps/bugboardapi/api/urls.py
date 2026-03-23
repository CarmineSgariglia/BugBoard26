from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from .health import health_check
from ..modules.auth.views import (
    CSRFTokenView,
    LoginView,
    LogoutView,
    MeView,
    PasswordOTPRequestView,
    PasswordOTPVerifyView,
    PasswordResetView,
    RefreshView,
)
from ..modules.issues.views import AttachmentUploadView, AttachmentViewSet, IssueViewSet, ProjectIssueListCreateView
from ..modules.notifications.views import NotificationViewSet
from ..modules.projects.views import ProjectViewSet
from ..modules.tags.views import TagViewSet
from ..modules.users.views import UserViewSet

router = SimpleRouter(trailing_slash=False)
router.register("users", UserViewSet, basename="users")
router.register("projects", ProjectViewSet, basename="projects")
router.register("issues", IssueViewSet, basename="issues")
router.register("attachments", AttachmentViewSet, basename="attachments")
router.register("notifications", NotificationViewSet, basename="notifications")
router.register("tags", TagViewSet, basename="tags")

urlpatterns = [
    path("health", health_check, name="health-check"),
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("docs", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("redoc", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("auth/csrf", CSRFTokenView.as_view(), name="csrf-token"),
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/refresh", RefreshView.as_view(), name="refresh"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("auth/me", MeView.as_view(), name="me"),
    path("auth/password/otp/request", PasswordOTPRequestView.as_view(), name="otp-request"),
    path("auth/password/otp/verify", PasswordOTPVerifyView.as_view(), name="otp-verify"),
    path("auth/password/reset", PasswordResetView.as_view(), name="password-reset"),
    path("projects/<int:projectId>/issues", ProjectIssueListCreateView.as_view(), name="project-issues"),
    path("issue-events/<int:updateId>/attachments", AttachmentUploadView.as_view(), name="issue-event-attachment"),
    *router.urls,
]
