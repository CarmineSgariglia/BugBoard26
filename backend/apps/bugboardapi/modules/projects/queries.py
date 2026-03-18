from .membership import visible_project_memberships
from .models import Project


def list_project_memberships(*, project: Project, include_admins: bool):
    return visible_project_memberships(
        project=project,
        include_admins=include_admins,
    )
