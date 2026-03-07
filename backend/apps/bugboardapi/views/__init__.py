"""BugBoardAPI views package."""

from .auth import (  # noqa: F401
    LoginView,
    LogoutView,
    MeView,
    PasswordOTPRequestView,
    PasswordOTPVerifyView,
    PasswordResetView,
    RefreshView,
)
from .issues import AttachmentUploadView, AttachmentViewSet,  IssueViewSet  # noqa: F401
from .notifications import NotificationViewSet  # noqa: F401
from .projects import ProjectIssueListCreateView, ProjectViewSet  # noqa: F401
from .tags import MetaEnumsView, TagViewSet, health_check  # noqa: F401
from .users import UserViewSet  # noqa: F401
