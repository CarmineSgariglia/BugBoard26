from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from django.contrib.auth.models import User
from django.db import transaction

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
from ..notifications.services import (
    notify_project_assigned,
    notify_project_removed,
    notify_project_unassigned,
)
from .membership import developer_project_memberships, visible_project_memberships
from .models import Project, ProjectMembership


@dataclass(frozen=True)
class ProjectNotificationHooks:
    project_assigned: Callable[..., object]
    project_removed: Callable[..., object]
    project_unassigned: Callable[..., object]


class ProjectService:
    def create_project_memberships(
        self,
        *,
        project: Project,
        creator: User,
        raw_user_ids,
        notifications: ProjectNotificationHooks | None = None,
    ) -> list[User]:
        notifications = notifications or self._notification_hooks()
        members: list[User] = []
        for user in self._active_team_users(raw_user_ids=raw_user_ids, excluded_user_id=creator.id):
            membership, _ = ProjectMembership.objects.get_or_create(project=project, user=user)
            members.append(membership.user)

        if members:
            notifications.project_assigned(users=members, actor=creator, project=project)

        return members

    def sync_project_team_members(
        self,
        *,
        project: Project,
        raw_user_ids,
        actor: User | None,
        notifications: ProjectNotificationHooks | None = None,
    ) -> tuple[list[User], list[User]]:
        notifications = notifications or self._notification_hooks()
        target_users = self._active_team_users(
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
            ProjectMembership.objects.get_or_create(project=project, user=user)

        removed_memberships = [
            membership
            for membership in current_developer_memberships
            if membership.user_id in to_remove_ids
        ]
        removed_users = [
            membership.user
            for membership in removed_memberships
            if membership.user.is_active
        ]
        if to_remove_ids:
            ProjectMembership.objects.filter(project=project, user_id__in=to_remove_ids).delete()

        if added_users:
            notifications.project_assigned(users=added_users, actor=actor, project=project)
        if removed_users:
            notifications.project_unassigned(users=removed_users, project=project)

        return added_users, removed_users

    def create_project_with_team(
        self,
        *,
        serializer,
        creator,
        raw_user_ids,
        notifications: ProjectNotificationHooks | None = None,
    ):
        notifications = notifications or self._notification_hooks()
        with transaction.atomic():
            project = serializer.save(created_by=creator)
            self.create_project_memberships(
                project=project,
                creator=creator,
                raw_user_ids=raw_user_ids,
                notifications=notifications,
            )
        return project

    def update_project_with_team(
        self,
        *,
        serializer,
        project: Project,
        raw_user_ids,
        has_team_payload: bool,
        actor: User | None,
        notifications: ProjectNotificationHooks | None = None,
    ):
        notifications = notifications or self._notification_hooks()
        with transaction.atomic():
            updated_project = serializer.save()
            if has_team_payload:
                self.sync_project_team_members(
                    project=project,
                    raw_user_ids=raw_user_ids,
                    actor=actor,
                    notifications=notifications,
                )
        return updated_project

    def delete_project_and_notify(
        self,
        *,
        project: Project,
        actor: User | None = None,
        notifications: ProjectNotificationHooks | None = None,
    ) -> None:
        notifications = notifications or self._notification_hooks()
        recipient_users = [
            membership.user
            for membership in visible_project_memberships(
                project=project,
                include_admins=True,
                active_only=True,
            )
        ]
        with transaction.atomic():
            project.delete()
            if recipient_users:
                notifications.project_removed(users=recipient_users, actor=actor, project=None)

    def _active_team_users(self, *, raw_user_ids, excluded_user_id: int) -> list[User]:
        user_ids = request_user_ids(raw_user_ids)
        users = list(
            User.objects.filter(id__in=user_ids, is_active=True).exclude(id=excluded_user_id)
        )
        return [user for user in users if not is_admin_user(user)]

    def _notification_hooks(self) -> ProjectNotificationHooks:
        return ProjectNotificationHooks(
            project_assigned=notify_project_assigned,
            project_removed=notify_project_removed,
            project_unassigned=notify_project_unassigned,
        )


project_service = ProjectService()
