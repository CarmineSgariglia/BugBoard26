from django.contrib.auth.models import User
from django.db import transaction

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
from ..issues.models import Issue
from ..issues.queries import apply_issue_filters
from ..issues.serializers import IssueSerializer
from ..notifications.models import NotifyType
from ..notifications.services import notify_users
from .models import Project, ProjectMembership
from .serializers import ProjectMembershipSerializer


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
        notify_users(notify_type=NotifyType.PROJECT_ADDED, users=members, project=project)


def sync_project_team_members(*, project: Project, raw_user_ids):
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
        notify_users(notify_type=NotifyType.PROJECT_ADDED, users=added_users, project=project)
    if removed_users:
        notify_users(notify_type=NotifyType.PROJECT_UNASSIGNED, users=removed_users, project=project)


def create_project_with_team(*, serializer, owner, raw_user_ids):
    with transaction.atomic():
        project = serializer.save(created_by=owner)
        create_project_memberships(project=project, owner=owner, raw_user_ids=raw_user_ids)
    return project


def update_project_with_team(*, serializer, project: Project, raw_user_ids, has_team_payload: bool):
    with transaction.atomic():
        updated_project = serializer.save()
        if has_team_payload:
            sync_project_team_members(project=project, raw_user_ids=raw_user_ids)
    return updated_project


def delete_project_and_notify(*, project: Project):
    recipient_users = list(User.objects.filter(project_memberships__project=project).distinct())
    if recipient_users:
        notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=recipient_users, project=project)
    project.delete()


def build_project_members_payload(*, project: Project, include_admins: bool):
    memberships = ProjectMembership.objects.filter(project=project).select_related("user")
    if not include_admins:
        memberships = [membership for membership in memberships if not is_admin_user(membership.user)]
    return ProjectMembershipSerializer(memberships, many=True).data


def list_project_issues_payload(*, project: Project, request):
    queryset = Issue.objects.filter(project=project).select_related("project", "reporter", "reporter__profile").prefetch_related("assignees", "tags")
    queryset = apply_issue_filters(queryset, request)
    return IssueSerializer(queryset, many=True).data
