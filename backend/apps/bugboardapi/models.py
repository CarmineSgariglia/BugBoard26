from .modules.issues.models import Attachment, Issue, IssueAssignee, IssueEvent, IssueStatus, IssueTag, IssueType, Priority
from .modules.notifications.models import Notification, NotifyType, NotifyUser
from .modules.projects.models import Project, ProjectMembership
from .modules.tags.models import Tag
from .modules.users.models import PasswordResetOTP, RevokedTokenSession, UserProfileImage

# This file is used to import all the models from the different modules and make them available for the rest of the application.

__all__ = [
    "Attachment",
    "Issue",
    "IssueAssignee",
    "IssueEvent",
    "IssueStatus",
    "IssueTag",
    "IssueType",
    "Notification",
    "NotifyType",
    "NotifyUser",
    "PasswordResetOTP",
    "Priority",
    "Project",
    "ProjectMembership",
    "RevokedTokenSession",
    "Tag",
    "UserProfileImage",
]
