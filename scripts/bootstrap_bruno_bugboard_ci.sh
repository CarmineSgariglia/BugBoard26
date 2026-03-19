#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

docker compose exec -T backend python manage.py seed_roles

docker compose exec -T backend python manage.py shell <<'PY'
from django.contrib.auth.models import User

from apps.bugboardapi.modules.issues.models import Issue, IssueStatus
from apps.bugboardapi.modules.notifications.services import notify_issue_updated
from apps.bugboardapi.modules.projects.models import Project, ProjectMembership
from apps.bugboardapi.roles import ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME, assign_global_role
from apps.bugboardapi.modules.users.models import UserProfileImage

PASSWORD = "StrongPass123!"


def ensure_user(*, username: str, email: str, is_admin: bool) -> User:
    user, _ = User.objects.get_or_create(
        username=username,
        defaults={"email": email, "is_staff": is_admin, "is_active": True},
    )
    changed = False
    if user.email != email:
        user.email = email
        changed = True
    desired_staff = is_admin or user.is_superuser
    if user.is_staff != desired_staff:
        user.is_staff = desired_staff
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if not user.check_password(PASSWORD):
        user.set_password(PASSWORD)
        changed = True
    if changed:
        user.save()
    assign_global_role(user, ADMIN_GROUP_NAME if is_admin else DEVELOPER_GROUP_NAME)
    UserProfileImage.objects.get_or_create(user=user)
    return user


admin = ensure_user(username="admin", email="admin@admin.it", is_admin=True)
dev = ensure_user(username="dev", email="dev@test.it", is_admin=False)

project, _ = Project.objects.get_or_create(
    name="Bruno CI Project",
    defaults={
        "description": "Project used for Bruno CI bootstrap",
        "color": "#0EA5E9",
        "icon": "folder",
        "created_by": admin,
    },
)
if project.created_by_id != admin.id:
    project.created_by = admin
    project.save(update_fields=["created_by"])

ProjectMembership.objects.get_or_create(project=project, user=admin)
ProjectMembership.objects.get_or_create(project=project, user=dev)

issue, _ = Issue.objects.get_or_create(
    project=project,
    reporter=admin,
    title="Bruno CI Issue",
    defaults={
        "description": "Issue used to bootstrap Bruno safe tests.",
        "issue_type": "BUG",
        "status": IssueStatus.TODO,
        "priority": "LOW",
    },
)

if not issue.notifications.filter(recipients__user=dev).exists():
    notify_issue_updated(users=[dev], issue=issue)

print("Bruno BugBoard CI bootstrap complete")
PY
