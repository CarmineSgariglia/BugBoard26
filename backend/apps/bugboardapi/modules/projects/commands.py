from django.contrib.auth.models import User
from django.db import transaction

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
from ..notifications.services import (
    notify_project_added,
    notify_project_removed,
    notify_project_unassigned,
)
from .membership import (
    developer_project_memberships,
    visible_project_memberships,
)
from .models import Project, ProjectMembership


def _active_team_users(*, raw_user_ids, excluded_user_id: int):
    user_ids = request_user_ids(raw_user_ids)
    users = list(
        User.objects.filter(id__in=user_ids, is_active=True).exclude(id=excluded_user_id)
    )
    return [user for user in users if not is_admin_user(user)]


def create_project_memberships(*, project: Project, creator: User, raw_user_ids):
    users = _active_team_users(raw_user_ids=raw_user_ids, excluded_user_id=creator.id)
    members = []
    for user in users:
        member, _ = ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
        )
        members.append(member.user)
    if members:
        notify_project_added(
            users=members,
            actor=creator,
            project=project,
        )


def sync_project_team_members(*, project: Project, raw_user_ids, actor: User | None = None):
    target_users = _active_team_users(
        raw_user_ids=raw_user_ids,
        excluded_user_id=project.created_by_id,
    )
    target_user_ids = {user.id for user in target_users}

    current_developer_memberships = developer_project_memberships(project=project)
    current_member_ids = {membership.user_id for membership in current_developer_memberships}

    to_add_ids = target_user_ids - current_member_ids
    to_remove_ids = current_member_ids - target_user_ids

    added_users = [user for user in target_users if user.id in to_add_ids]
    for user in added_users:
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
        )

    removed_memberships = [
        membership for membership in current_developer_memberships if membership.user_id in to_remove_ids
    ]
    removed_users = [membership.user for membership in removed_memberships if membership.user.is_active]
    if to_remove_ids:
        ProjectMembership.objects.filter(project=project, user_id__in=to_remove_ids).delete()

    if added_users:
        notify_project_added(
            users=added_users,
            actor=actor,
            project=project,
        )
    if removed_users:
        notify_project_unassigned(users=removed_users, project=project)


def create_project_with_team(*, serializer, creator, raw_user_ids):
    with transaction.atomic():
        project = serializer.save(created_by=creator)
        create_project_memberships(project=project, creator=creator, raw_user_ids=raw_user_ids)
    return project


def update_project_with_team(*, serializer, project: Project, raw_user_ids, has_team_payload: bool, actor: User | None = None):
    with transaction.atomic():
        updated_project = serializer.save()
        if has_team_payload:
            sync_project_team_members(project=project, raw_user_ids=raw_user_ids, actor=actor)
    return updated_project


def delete_project_and_notify(*, project: Project, actor: User):
    recipient_users = [
        membership.user
        for membership in visible_project_memberships(
            project=project,
            include_admins=True,
            active_only=True,
        )
        if membership.user_id != actor.id
    ]
    with transaction.atomic():
        project.delete()
        if recipient_users:
            notify_project_removed(users=recipient_users, project=None, actor=actor)
