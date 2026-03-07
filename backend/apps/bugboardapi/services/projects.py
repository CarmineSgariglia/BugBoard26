from django.contrib.auth.models import User

from ..models import NotifyType, Project, ProjectMembership
from .issues import request_user_ids
from .notifications import notify_users


def create_project_memberships(*, project: Project, owner: User, raw_user_ids):
    ProjectMembership.objects.get_or_create(
        project=project,
        user=owner,
        defaults={"role": ProjectMembership.Role.ADMIN},
    )
    user_ids = request_user_ids(raw_user_ids)
    users = User.objects.filter(id__in=user_ids, is_active=True).exclude(id=owner.id)
    members = []
    for user in users:
        member, _ = ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": ProjectMembership.Role.DEVELOPER},
        )
        members.append(member.user)
    if members:
        notify_users(notify_type=NotifyType.PROJECT_ADDED, users=members, project=project)


def sync_project_team_members(*, project: Project, raw_user_ids):
    user_ids = request_user_ids(raw_user_ids)
    target_users = list(User.objects.filter(id__in=user_ids, is_active=True).exclude(id=project.created_by_id))
    target_user_ids = {user.id for user in target_users}

    developer_memberships = ProjectMembership.objects.filter(
        project=project,
        role=ProjectMembership.Role.DEVELOPER,
    ).select_related("user")
    current_developer_ids = {membership.user_id for membership in developer_memberships}

    to_add_ids = target_user_ids - current_developer_ids
    to_remove_ids = current_developer_ids - target_user_ids

    added_users = [user for user in target_users if user.id in to_add_ids]
    for user in added_users:
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": ProjectMembership.Role.DEVELOPER},
        )

    removed_memberships = list(developer_memberships.filter(user_id__in=to_remove_ids))
    removed_users = [membership.user for membership in removed_memberships]
    if to_remove_ids:
        developer_memberships.filter(user_id__in=to_remove_ids).delete()

    if added_users:
        notify_users(notify_type=NotifyType.PROJECT_ADDED, users=added_users, project=project)
    if removed_users:
        notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=removed_users, project=project)
