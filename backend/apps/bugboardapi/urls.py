from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttachmentUploadView,
    AttachmentViewSet,
    CSRFTokenView,
    IssueViewSet,
    LoginView,
    LogoutView,
    MeView,
    NotificationViewSet,
    PasswordOTPRequestView,
    PasswordOTPVerifyView,
    PasswordResetView,
    ProjectIssueListCreateView,
    ProjectViewSet,
    RefreshView,
    TagViewSet,
    UserViewSet,
    health_check,
)

# Router-backed resource roots use ViewSet + mixins; flow-oriented endpoints stay on APIView.
router = DefaultRouter(trailing_slash=False)
router.register("users", UserViewSet, basename="users")
router.register("projects", ProjectViewSet, basename="projects")
router.register("issues", IssueViewSet, basename="issues")
router.register("attachments", AttachmentViewSet, basename="attachments")
router.register("notifications", NotificationViewSet, basename="notifications")
router.register("tags", TagViewSet, basename="tags")

urlpatterns = [
    # Flow/bootstrap endpoints that are not resource roots.
    path("health", health_check, name="health-check"),
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
