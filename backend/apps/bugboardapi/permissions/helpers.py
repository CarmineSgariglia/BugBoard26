from __future__ import annotations

from typing import TYPE_CHECKING

from ..modules.issues.membership import is_developer_issue_assignee
from ..modules.projects.membership import is_project_member as has_project_membership

if TYPE_CHECKING:
    from django.contrib.auth.models import User

    from ..modules.issues.models import Issue
    from ..modules.projects.models import Project


def is_project_member(user: User, project: Project) -> bool:
    return has_project_membership(user=user, project=project)


def is_issue_assignee(user: User, issue: Issue) -> bool:
    return is_developer_issue_assignee(issue=issue, user=user)
