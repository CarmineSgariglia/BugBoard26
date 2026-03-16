from django.contrib.auth.models import User

from ..modules.issues.models import Issue, IssueAssignee
from ..modules.projects.models import Project


def is_project_member(user: User, project: Project) -> bool:
    return project.members.filter(id=user.id).exists()


def is_issue_assignee(user: User, issue: Issue) -> bool:
    return IssueAssignee.objects.filter(issue=issue, user=user).exists()
