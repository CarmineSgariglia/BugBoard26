from django.contrib.auth.models import User
from django.db import transaction

from ...common.parsing import request_user_ids
from ..notifications.services import (
    notify_project_added,
    notify_project_removed,
    notify_project_unassigned,
)
from .models import Project, ProjectMembership


def create_project_memberships(*, project: Project, owner: User, raw_user_ids):
    ProjectMembership.objects.get_or_create(
        project=project,
        user=owner,
    )
    user_ids = request_user_ids(raw_user_ids)
    users = User.objects.filter(id__in=user_ids, is_active=True).exclude(id=owner.id)
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
            actor=owner,
            project=project,
        )


def sync_project_team_members(*, project: Project, raw_user_ids, actor: User | None = None):
    user_ids = request_user_ids(raw_user_ids)
    target_users = list(User.objects.filter(id__in=user_ids, is_active=True).exclude(id=project.created_by_id))
    target_user_ids = {user.id for user in target_users}

    mutable_memberships = ProjectMembership.objects.filter(project=project).exclude(user_id=project.created_by_id).select_related("user")
    current_member_ids = {membership.user_id for membership in mutable_memberships}

    to_add_ids = target_user_ids - current_member_ids
    to_remove_ids = current_member_ids - target_user_ids

    added_users = [user for user in target_users if user.id in to_add_ids]
    for user in added_users:
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
        )

    removed_memberships = list(mutable_memberships.filter(user_id__in=to_remove_ids))
    removed_users = [membership.user for membership in removed_memberships]
    if to_remove_ids:
        mutable_memberships.filter(user_id__in=to_remove_ids).delete()

    if added_users:
        notify_project_added(
            users=added_users,
            actor=actor,
            project=project,
        )
    if removed_users:
        notify_project_unassigned(users=removed_users, project=project)


def create_project_with_team(*, serializer, owner, raw_user_ids):
    with transaction.atomic():
        project = serializer.save(created_by=owner)
        create_project_memberships(project=project, owner=owner, raw_user_ids=raw_user_ids)
    return project


def update_project_with_team(*, serializer, project: Project, raw_user_ids, has_team_payload: bool, actor: User | None = None):
    with transaction.atomic():
        updated_project = serializer.save()
        if has_team_payload:
            sync_project_team_members(project=project, raw_user_ids=raw_user_ids, actor=actor)
    return updated_project


def delete_project_and_notify(*, project: Project):
    recipient_users = list(User.objects.filter(project_memberships__project=project).distinct())
    if recipient_users:
        notify_project_removed(users=recipient_users, project=project)
    project.delete()
