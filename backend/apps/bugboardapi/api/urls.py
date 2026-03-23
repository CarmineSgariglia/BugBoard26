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
from ..modules.issues.views import (
    IssueAssigneeDetailView,
    IssueAttachmentCollectionView,
    IssueAttachmentDetailView,
    IssueEventAttachmentCollectionView,
    IssueViewSet,
    ProjectIssueListCreateView,
)
from ..modules.notifications.views import NotificationViewSet
from ..modules.projects.views import ProjectViewSet
from ..modules.tags.views import TagViewSet
from ..modules.users.views import (
    CurrentUserPasswordView,
    CurrentUserProfileImageView,
    UserPasswordView,
    UserProfileImageView,
    UserViewSet,
)

router = SimpleRouter(trailing_slash=False)
router.register("users", UserViewSet, basename="users")
router.register("projects", ProjectViewSet, basename="projects")
router.register("issues", IssueViewSet, basename="issues")
router.register("tags", TagViewSet, basename="tags")

urlpatterns = [
    path("health", health_check, name="health-check"),
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("docs", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("redoc", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("security/csrf-token", CSRFTokenView.as_view(), name="csrf-token"),
    path("sessions", LoginView.as_view(), name="sessions-create"),
    path("sessions/current/access-token", RefreshView.as_view(), name="sessions-refresh"),
    path("sessions/current", LogoutView.as_view(), name="sessions-current"),
    path("users/me", MeView.as_view(), name="users-me"),
    path("password-reset-requests", PasswordOTPRequestView.as_view(), name="password-reset-requests"),
    path("password-reset-verifications", PasswordOTPVerifyView.as_view(), name="password-reset-verifications"),
    path("password-resets", PasswordResetView.as_view(), name="password-resets"),
    path("users/me/password", CurrentUserPasswordView.as_view(), name="users-me-password"),
    path("users/<int:userId>/password", UserPasswordView.as_view(), name="users-password"),
    path("users/me/profile-image", CurrentUserProfileImageView.as_view(), name="users-me-profile-image"),
    path("users/<int:userId>/profile-image", UserProfileImageView.as_view(), name="users-profile-image"),
    path(
        "notifications",
        NotificationViewSet.as_view({"get": "list", "patch": "partial_update_all"}),
        name="notifications-list",
    ),
    path(
        "notifications/stream",
        NotificationViewSet.as_view({"get": "stream"}),
        name="notifications-stream",
    ),
    path(
        "notifications/<int:notificationId>",
        NotificationViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="notifications-detail",
    ),
    path("projects/<int:projectId>/issues", ProjectIssueListCreateView.as_view(), name="project-issues"),
    path(
        "issues/<int:issueId>/assignees/<int:userId>",
        IssueAssigneeDetailView.as_view(),
        name="issue-assignee-detail",
    ),
    path(
        "issues/<int:issueId>/attachments",
        IssueAttachmentCollectionView.as_view(),
        name="issue-attachments",
    ),
    path(
        "issues/<int:issueId>/attachments/<int:attachmentId>",
        IssueAttachmentDetailView.as_view(),
        name="issue-attachment-detail",
    ),
    path(
        "issues/<int:issueId>/events/<int:eventId>/attachments",
        IssueEventAttachmentCollectionView.as_view(),
        name="issue-event-attachments",
    ),
    *router.urls,
]
