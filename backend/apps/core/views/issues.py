"""Issue management views."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    EventType,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueStatus,
    NotifyType,
    ProjectMembership,
)
from ..permissions import is_admin
from ..serializers import (
    AttachmentSerializer,
    IssueEventSerializer,
    IssueSerializer,
)
from ..services import notify_users
from .helpers import (
    apply_issue_filters,
    check_admin,
    ensure_issue_access,
    maybe_create_attachment,
    request_user_ids,
    user_project_ids,
)

logger = logging.getLogger(__name__)


class IssueViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = IssueSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Issue.objects.select_related("project", "reporter").prefetch_related("assignees", "tags")
    lookup_field = "issue_id"
    lookup_url_kwarg = "issueId"

    def get_queryset(self):
        queryset = Issue.objects.select_related("project", "reporter").prefetch_related("assignees", "tags")
        queryset = queryset.filter(project_id__in=user_project_ids(self.request.user))
        project_id = self.request.query_params.get("projectId")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return apply_issue_filters(queryset, self.request)

    def perform_destroy(self, instance):
        check_admin(self.request.user)
        ensure_issue_access(self.request.user, instance)
        title = self.request.data.get("title")
        if not title:
            raise ValidationError({"title": "Issue title confirmation is required"})
        if title != instance.title:
            raise ValidationError({"title": "Issue title confirmation mismatch"})
        recipients = list(User.objects.filter(issue_assignments__issue=instance).distinct())
        if recipients:
            notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=instance)
        instance.delete()

    def perform_update(self, serializer):
        issue = serializer.save()

        # Track direct issue edits (PATCH/PUT) and fan out update notifications.
        message = (self.request.data.get("message", "") or "").strip() or "Issue updated"
        IssueEvent.objects.create(
            issue=issue,
            actor=self.request.user,
            event_type=EventType.EDIT,
            message=message,
        )

        recipients = list(
            User.objects.filter(Q(issue_assignments__issue=issue) | Q(id=issue.reporter_id))
            .exclude(id=self.request.user.id)
            .distinct()
        )
        if recipients:
            notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=issue)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, issueId=None):
        check_admin(request.user)
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        user_ids = request_user_ids(request.data.get("userIds", []))
        if not user_ids:
            raise ValidationError({"userIds": "At least one userId is required"})

        allowed_ids = set(
            ProjectMembership.objects.filter(project=issue.project, user_id__in=user_ids).values_list("user_id", flat=True)
        )
        disallowed_ids = [uid for uid in user_ids if uid not in allowed_ids]
        if disallowed_ids:
            raise ValidationError({"userIds": f"Users must be members of project: {disallowed_ids}"})

        assigned_users = []
        for user_id in user_ids:
            assignment, _ = IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
            assigned_users.append(assignment.user)

        IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.ASSIGN, message="Assignees updated")
        notify_users(notify_type=NotifyType.ISSUE_ASSIGNED, users=assigned_users, issue=issue)
        return Response({"detail": "Issue assigned"})

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, issueId=None):
        check_admin(request.user)
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        user_ids = request_user_ids(request.data.get("userIds", []))
        if not user_ids:
            raise ValidationError({"userIds": "At least one userId is required"})
        users = list(User.objects.filter(id__in=user_ids))
        IssueAssignee.objects.filter(issue=issue, user_id__in=user_ids).delete()
        IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.UNASSIGN, message="Assignees removed")
        if users:
            notify_users(notify_type=NotifyType.ISSUE_UNASSIGNED, users=users, issue=issue)
        return Response({"detail": "Issue unassigned"})

    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, issueId=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=issue, user=request.user).exists()):
            raise PermissionDenied("Only assigned users or admins can change status")

        new_status = request.data.get("status")
        if new_status not in dict(IssueStatus.choices):
            raise ValidationError({"status": "Invalid status"})

        old_status = issue.status
        issue.status = new_status
        issue.closed_at = timezone.now() if new_status == IssueStatus.DONE else None
        issue.save(update_fields=["status", "closed_at", "updated_at"])

        message = request.data.get("message", "")
        event = IssueEvent.objects.create(
            issue=issue,
            actor=request.user,
            event_type=EventType.STATUS_CHANGE,
            message=message,
            old_status=old_status,
            new_status=new_status,
        )
        maybe_create_attachment(event, request.data)

        if new_status == IssueStatus.DONE:
            notify_users(notify_type=NotifyType.ISSUE_CLOSED, users=[issue.reporter], issue=issue)
        return Response(IssueSerializer(issue).data)

    @action(detail=True, methods=["post"], url_path="updates")
    def add_update(self, request, issueId=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=issue, user=request.user).exists()):
            raise PermissionDenied("Only assigned users or admins can add updates")

        message = request.data.get("message", "")
        if not message:
            raise ValidationError({"message": "message is required"})

        event = IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.COMMENT, message=message)
        maybe_create_attachment(event, request.data)

        recipients = list(User.objects.filter(issue_assignments__issue=issue).exclude(id=request.user.id).distinct())
        if recipients:
            notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=issue)

        return Response(IssueEventSerializer(event).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="suggestions")
    def suggestions(self, request, issueId=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        member_counts = (
            User.objects.filter(project_memberships__project=issue.project, is_active=True)
            .annotate(
                open_count=Count(
                    "issue_assignments",
                    filter=Q(issue_assignments__issue__status__in=[IssueStatus.TODO, IssueStatus.IN_PROGRESS]),
                )
            )
            .order_by("open_count", "username")
        )
        payload = [
            {
                "userId": user.id,
                "username": user.username,
                "suggestionScore": max(0, 100 - user.open_count * 10),
                "openAssignments": user.open_count,
            }
            for user in member_counts
        ]
        return Response(payload)

    def partial_update(self, request, *args, **kwargs):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=issue, user=request.user).exists()):
            raise PermissionDenied("Only assigned users or admins can edit issues")
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=issue, user=request.user).exists()):
            raise PermissionDenied("Only assigned users or admins can edit issues")
        return super().update(request, *args, **kwargs)


class AttachmentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, updateId):
        event = IssueEvent.objects.filter(update_id=updateId).first()
        if not event:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_issue_access(request.user, event.issue)
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=event.issue, user=request.user).exists()):
            raise PermissionDenied("Not allowed")

        attachment = maybe_create_attachment(event, request.data)
        if not attachment:
            raise ValidationError({"path": "path is required"})
        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)
