from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Callable

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ...common.parsing import request_user_ids
from ...roles import is_admin_user
from ..notifications.services import (
    notify_issue_added,
    notify_issue_assigned,
    notify_issue_closed,
    notify_issue_unassigned,
    notify_issue_updated,
)
from ..projects.membership import (
    admin_project_subscription_users,
    classify_project_assignment_user_ids,
)
from ..tags.services import resolve_tag_ids
from .activity import issue_activity_service
from .membership import effective_admin_issue_subscription_users
from .models import EventType, Issue, IssueAssignee, IssueEvent, IssueStatus, IssueTag

if TYPE_CHECKING:
    from ..projects.models import Project

_UNSET = object()


@dataclass(frozen=True)
class IssueNotificationHooks:
    issue_added: Callable[..., object]
    issue_updated: Callable[..., object]
    issue_assigned: Callable[..., object]
    issue_unassigned: Callable[..., object]
    issue_closed: Callable[..., object]


@dataclass(frozen=True)
class IssueSideEffectPlan:
    event_type: str
    message: str
    event_fields: dict[str, object] = field(default_factory=dict)
    payload: dict | None = None
    attachments_required: bool = False
    max_files: int = 10
    notification_sender: Callable[..., object] | None = None
    notification_users: list[User] = field(default_factory=list)
    notification_users_resolver: Callable[[Issue, object], list[User]] | None = None
    notification_actor: object = _UNSET


class IssueWorkflow:
    def __init__(self, *, activity_service=issue_activity_service) -> None:
        self._activity_service = activity_service

    def ensure_valid_status(self, requested_status: str) -> None:
        if requested_status not in dict(IssueStatus.choices):
            raise ValidationError({"status": "Invalid status"})

    def plan_issue_update(
        self,
        *,
        issue: Issue,
        actor,
        old_status: str,
        requested_status: str,
        raw_message,
        notifications: IssueNotificationHooks,
    ) -> IssueSideEffectPlan:
        self.ensure_valid_status(requested_status)
        normalized_message = self._activity_service.validate_message(raw_message, strip=True)

        if requested_status != old_status:
            return self._plan_status_change(
                issue=issue,
                actor=actor,
                old_status=old_status,
                new_status=requested_status,
                normalized_message=normalized_message,
                notifications=notifications,
            )

        return IssueSideEffectPlan(
            event_type=EventType.EDIT,
            message=normalized_message or "Issue updated",
            notification_sender=notifications.issue_updated,
            notification_users_resolver=lambda current_issue, current_actor: self._activity_service.notification_recipients(
                issue=current_issue,
                actor=current_actor,
            ),
        )

    def _plan_status_change(
        self,
        *,
        issue: Issue,
        actor,
        old_status: str,
        new_status: str,
        normalized_message: str,
        notifications: IssueNotificationHooks,
    ) -> IssueSideEffectPlan:
        if new_status == IssueStatus.DONE:
            return IssueSideEffectPlan(
                event_type=EventType.STATUS_CHANGE,
                message=normalized_message,
                event_fields={"old_status": old_status, "new_status": new_status},
                notification_sender=notifications.issue_closed,
                notification_users_resolver=lambda current_issue, _current_actor: self._issue_closed_recipients(
                    issue=current_issue,
                ),
                notification_actor=actor,
            )

        return IssueSideEffectPlan(
            event_type=EventType.STATUS_CHANGE,
            message=normalized_message,
            event_fields={"old_status": old_status, "new_status": new_status},
            notification_sender=notifications.issue_updated,
            notification_users_resolver=lambda current_issue, current_actor: self._activity_service.notification_recipients(
                issue=current_issue,
                actor=current_actor,
            ),
        )

    def _issue_closed_recipients(self, *, issue: Issue) -> list[User]:
        return [
            issue.reporter,
            *admin_project_subscription_users(project=issue.project, active_only=True),
        ]


class IssueService:
    def __init__(
        self,
        *,
        workflow: IssueWorkflow | None = None,
        activity_service=issue_activity_service,
    ) -> None:
        self._workflow = workflow or IssueWorkflow()
        self._activity_service = activity_service

    def create_from_validated_data(self, validated_data: dict) -> Issue:
        assignee_ids = validated_data.pop("assigneeIds", [])
        tag_ids = validated_data.pop("tagIds", [])
        tag_names = validated_data.pop("tagNames", [])
        resolved_tag_ids = resolve_tag_ids(tag_ids=tag_ids, tag_names=tag_names)

        issue = Issue.objects.create(**validated_data)
        self.ensure_issue_assignees(issue=issue, user_ids=assignee_ids)
        self._sync_issue_tags(issue=issue, tag_ids=resolved_tag_ids)
        return issue

    def update_from_validated_data(self, instance: Issue, validated_data: dict) -> Issue:
        assignee_ids = validated_data.pop("assigneeIds", None)
        tag_ids = validated_data.pop("tagIds", None)
        tag_names = validated_data.pop("tagNames", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if validated_data:
            instance.save()

        if assignee_ids is not None:
            self.replace_issue_assignees(issue=instance, assignee_ids=assignee_ids)

        if tag_ids is not None or tag_names is not None:
            resolved_tag_ids = resolve_tag_ids(tag_ids=tag_ids or [], tag_names=tag_names or [])
            self._sync_issue_tags(issue=instance, tag_ids=resolved_tag_ids)

        return instance

    def validate_project_assignee_ids(
        self,
        *,
        project,
        assignee_ids: list[int] | None,
        classify_user_ids: Callable[..., tuple[list[int], list[int], list[int]]] | None = None,
    ) -> None:
        self._validate_assignable_project_user_ids(
            project=project,
            user_ids=assignee_ids,
            field_name="assigneeIds",
            classify_user_ids=classify_user_ids or classify_project_assignment_user_ids,
        )

    def validate_issue_assignment_user_ids(
        self,
        *,
        project,
        user_ids: list[int] | None,
        classify_user_ids: Callable[..., tuple[list[int], list[int], list[int]]] | None = None,
    ) -> None:
        self._validate_assignable_project_user_ids(
            project=project,
            user_ids=user_ids,
            field_name="userIds",
            classify_user_ids=classify_user_ids or classify_project_assignment_user_ids,
        )

    def create_issue_for_project(
        self,
        *,
        serializer,
        reporter,
        project: Project,
        notifications: IssueNotificationHooks | None = None,
    ) -> Issue:
        notifications = notifications or self._notification_hooks()
        with transaction.atomic():
            issue = serializer.save(project=project, reporter=reporter)
            if not is_admin_user(reporter):
                self.ensure_issue_assignees(issue=issue, user_ids=[reporter.id])
            self._dispatch_side_effects(
                issue=issue,
                actor=reporter,
                plan=IssueSideEffectPlan(
                    event_type=EventType.CREATE,
                    message="Issue created",
                    notification_sender=notifications.issue_added,
                    notification_users=admin_project_subscription_users(
                        project=project,
                        active_only=True,
                    ),
                    notification_actor=reporter,
                ),
            )
        return issue

    def update_issue_from_serializer(
        self,
        *,
        serializer,
        actor,
        raw_message,
        notifications: IssueNotificationHooks | None = None,
    ) -> Issue:
        notifications = notifications or self._notification_hooks()
        issue = serializer.instance
        old_status = issue.status
        requested_status = serializer.validated_data.get("status", old_status)
        self._workflow.ensure_valid_status(requested_status)

        with transaction.atomic():
            issue = serializer.save()
            plan = self._workflow.plan_issue_update(
                issue=issue,
                actor=actor,
                old_status=old_status,
                requested_status=requested_status,
                raw_message=raw_message,
                notifications=notifications,
            )
            self._dispatch_side_effects(issue=issue, actor=actor, plan=plan)
        return issue

    def assign_issue_users(
        self,
        *,
        issue: Issue,
        actor,
        raw_user_ids,
        notifications: IssueNotificationHooks | None = None,
    ) -> None:
        notifications = notifications or self._notification_hooks()
        user_ids = request_user_ids(raw_user_ids)
        if not user_ids:
            raise ValidationError({"userIds": "At least one userId is required"})

        self.validate_issue_assignment_user_ids(project=issue.project, user_ids=user_ids)

        with transaction.atomic():
            assigned_users = self.add_issue_assignees(issue=issue, user_ids=user_ids)
            if not assigned_users:
                return

            self._dispatch_side_effects(
                issue=issue,
                actor=actor,
                plan=IssueSideEffectPlan(
                    event_type=EventType.ASSIGN,
                    message="Assignees updated",
                    notification_sender=notifications.issue_assigned,
                    notification_users=self._merge_issue_notification_users(
                        users=assigned_users,
                        issue=issue,
                    ),
                    notification_actor=actor,
                ),
            )

    def unassign_issue_users(
        self,
        *,
        issue: Issue,
        actor,
        raw_user_ids,
        notifications: IssueNotificationHooks | None = None,
    ) -> None:
        notifications = notifications or self._notification_hooks()
        user_ids = request_user_ids(raw_user_ids)
        if not user_ids:
            raise ValidationError({"userIds": "At least one userId is required"})

        with transaction.atomic():
            users = self.remove_existing_issue_assignees(issue=issue, user_ids=user_ids)
            if not users:
                return

            active_users = [user for user in users if user.is_active]
            self._dispatch_side_effects(
                issue=issue,
                actor=actor,
                plan=IssueSideEffectPlan(
                    event_type=EventType.UNASSIGN,
                    message="Assignees removed",
                    notification_sender=notifications.issue_unassigned,
                    notification_users=self._merge_issue_notification_users(
                        users=active_users,
                        issue=issue,
                    ),
                    notification_actor=actor,
                ),
            )

    def create_issue_comment(
        self,
        *,
        issue: Issue,
        actor,
        raw_message,
        payload,
        notifications: IssueNotificationHooks | None = None,
    ) -> IssueEvent:
        notifications = notifications or self._notification_hooks()
        message = self._activity_service.validate_message(raw_message, required=True, strip=True)
        with transaction.atomic():
            return self._dispatch_side_effects(
                issue=issue,
                actor=actor,
                plan=IssueSideEffectPlan(
                    event_type=EventType.COMMENT,
                    message=message,
                    payload=payload,
                    notification_sender=notifications.issue_updated,
                    notification_users=self._activity_service.notification_recipients(issue=issue, actor=actor),
                ),
            )

    def ensure_issue_assignees(self, *, issue: Issue, user_ids: list[int]) -> list[User]:
        assignees: list[User] = []
        for user_id in user_ids:
            assignment, _ = IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
            assignees.append(assignment.user)
        return assignees

    def add_issue_assignees(self, *, issue: Issue, user_ids: list[int]) -> list[User]:
        added_assignees: list[User] = []
        for user_id in user_ids:
            assignment, created = IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
            if created:
                added_assignees.append(assignment.user)
        return added_assignees

    def remove_existing_issue_assignees(self, *, issue: Issue, user_ids: list[int]) -> list[User]:
        users = list(
            User.objects.filter(
                issue_assignments__issue=issue,
                id__in=user_ids,
            ).distinct()
        )
        IssueAssignee.objects.filter(
            issue=issue,
            user_id__in=[user.id for user in users],
        ).delete()
        return users

    def replace_issue_assignees(self, *, issue: Issue, assignee_ids: list[int]) -> list[User]:
        IssueAssignee.objects.filter(issue=issue).exclude(user_id__in=assignee_ids).delete()
        return self.ensure_issue_assignees(issue=issue, user_ids=assignee_ids)

    def _validate_assignable_project_user_ids(
        self,
        *,
        project,
        user_ids: list[int] | None,
        field_name: str,
        classify_user_ids: Callable[..., tuple[list[int], list[int], list[int]]],
    ) -> None:
        if user_ids is None or not user_ids:
            return

        invalid_ids, admin_ids, inactive_ids = classify_user_ids(
            project=project,
            user_ids=user_ids,
        )
        if invalid_ids:
            raise ValidationError({field_name: f"Users must be members of project: {invalid_ids}"})
        if admin_ids:
            raise ValidationError({field_name: f"Admin users cannot be assigned to issues: {admin_ids}"})
        if inactive_ids:
            raise ValidationError({field_name: f"Users must be members of project: {inactive_ids}"})

    def _notification_hooks(self) -> IssueNotificationHooks:
        return IssueNotificationHooks(
            issue_added=notify_issue_added,
            issue_updated=notify_issue_updated,
            issue_assigned=notify_issue_assigned,
            issue_unassigned=notify_issue_unassigned,
            issue_closed=notify_issue_closed,
        )

    def _dispatch_side_effects(
        self,
        *,
        issue: Issue,
        actor,
        plan: IssueSideEffectPlan,
    ) -> IssueEvent:
        if plan.payload is None:
            event = self._activity_service.create_event(
                issue=issue,
                actor=actor,
                event_type=plan.event_type,
                message=plan.message,
                **plan.event_fields,
            )
        else:
            event = self._activity_service.create_event_with_attachments(
                issue=issue,
                actor=actor,
                event_type=plan.event_type,
                message=plan.message,
                payload=plan.payload,
                attachments_required=plan.attachments_required,
                max_files=plan.max_files,
                **plan.event_fields,
            )

        if plan.notification_sender and plan.notification_users:
            notification_users = plan.notification_users
        elif plan.notification_sender and plan.notification_users_resolver is not None:
            notification_users = plan.notification_users_resolver(issue, actor)
        else:
            notification_users = []

        if plan.notification_sender and notification_users:
            notification_kwargs = {
                "users": notification_users,
                "issue": issue,
            }
            if plan.notification_actor is not _UNSET:
                notification_kwargs["actor"] = plan.notification_actor
            plan.notification_sender(**notification_kwargs)

        return event

    def _merge_issue_notification_users(self, *, users: list[User], issue: Issue) -> list[User]:
        recipients_by_id = {
            user.id: user
            for user in users
            if getattr(user, "id", None) is not None
        }
        for user in effective_admin_issue_subscription_users(issue=issue, active_only=True):
            recipients_by_id[user.id] = user
        return list(recipients_by_id.values())

    def _sync_issue_tags(self, *, issue: Issue, tag_ids: list[int]) -> None:
        IssueTag.objects.filter(issue=issue).exclude(tag_id__in=tag_ids).delete()
        for tag_id in tag_ids:
            IssueTag.objects.get_or_create(issue=issue, tag_id=tag_id)

issue_service = IssueService(workflow=IssueWorkflow(activity_service=issue_activity_service))
