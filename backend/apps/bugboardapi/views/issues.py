"""Issue management views."""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    Attachment,
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
from ..services import (
    apply_issue_filters,
    create_attachment_for_event,
    create_issue_event_with_attachment,
    delete_media_path,
    notify_users,
    request_user_ids,
    validate_issue_event_message,
)
from ..permissions import (
    check_assignee_or_admin,
    check_admin,
    ensure_issue_access,
    user_project_ids,
)
from ..roles import is_admin_user

logger = logging.getLogger(__name__)


class IssueViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = IssueSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Issue.objects.select_related("project", "reporter", "reporter__profile").prefetch_related("assignees", "tags")
    lookup_field = "issue_id"
    lookup_url_kwarg = "issueId"

    def get_queryset(self):
        queryset = Issue.objects.select_related("project", "reporter", "reporter__profile").prefetch_related("assignees", "tags")
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

        memberships = list(
            ProjectMembership.objects.filter(project=issue.project, user_id__in=user_ids).select_related("user")
        )
        allowed_ids = {membership.user_id for membership in memberships}
        disallowed_ids = [uid for uid in user_ids if uid not in allowed_ids]
        if disallowed_ids:
            raise ValidationError({"userIds": f"Users must be members of project: {disallowed_ids}"})
        admin_ids = [membership.user_id for membership in memberships if is_admin_user(membership.user)]
        if admin_ids:
            raise ValidationError({"userIds": f"Admin users cannot be assigned to issues: {admin_ids}"})

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
        check_assignee_or_admin(request.user, issue)

        new_status = request.data.get("status")
        if new_status not in dict(IssueStatus.choices):
            raise ValidationError({"status": "Invalid status"})

        old_status = issue.status
        issue.status = new_status
        issue.save(update_fields=["status"])

        message = request.data.get("message", "")
        event = create_issue_event_with_attachment(
            issue=issue,
            actor=request.user,
            event_type=EventType.STATUS_CHANGE,
            message=message,
            payload=request.data,
            old_status=old_status,
            new_status=new_status,
        )

        if new_status == IssueStatus.DONE:
            notify_users(notify_type=NotifyType.ISSUE_CLOSED, users=[issue.reporter], issue=issue)
        return Response(IssueSerializer(issue).data)

    @action(detail=True, methods=["get", "post"], url_path="updates")
    def updates(self, request, issueId=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)

        if request.method.lower() == "get":
            events = issue.events.select_related("actor").prefetch_related("attachments").all()
            return Response(IssueEventSerializer(events, many=True).data)

        check_assignee_or_admin(request.user, issue)

        message = validate_issue_event_message(
            request.data.get("message", ""),
            required=True,
            strip=True,
        )

        event = create_issue_event_with_attachment(
            issue=issue,
            actor=request.user,
            event_type=EventType.COMMENT,
            message=message,
            payload=request.data,
        )

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
            if not is_admin_user(user)
        ]
        return Response(payload)

    @action(detail=True, methods=["patch"], url_path="details")
    def details(self, request, issueId=None):
        """Dedicated endpoint for issue edit pages to patch full issue details."""
        return self.partial_update(request, issueId=issueId)

    def partial_update(self, request, *args, **kwargs):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        check_assignee_or_admin(request.user, issue)
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        check_assignee_or_admin(request.user, issue)
        return super().update(request, *args, **kwargs)


class AttachmentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, updateId):
        event = IssueEvent.objects.filter(update_id=updateId).first()
        if not event:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_issue_access(request.user, event.issue)
        check_assignee_or_admin(request.user, event.issue)

        attachment = create_attachment_for_event(event, request.data)
        if not attachment:
            raise ValidationError({"file": "Attachment file is required"})
        created_attachment = attachment[0] if isinstance(attachment, list) else attachment
        return Response(AttachmentSerializer(created_attachment).data, status=status.HTTP_201_CREATED)


class AttachmentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = Attachment.objects.select_related("update", "update__issue")
    lookup_field = "attachment_id"
    lookup_url_kwarg = "attachmentId"

    def get_queryset(self):
        queryset = super().get_queryset().filter(update__issue__project_id__in=user_project_ids(self.request.user))
        issue_id = self.request.query_params.get("issueId")
        update_id = self.request.query_params.get("updateId")
        if issue_id:
            queryset = queryset.filter(update__issue__issue_id=issue_id)
        if update_id:
            queryset = queryset.filter(update_id=update_id)
        return queryset

    def _ensure_attachment_write_access(self, issue: Issue) -> None:
        ensure_issue_access(self.request.user, issue)
        check_assignee_or_admin(self.request.user, issue)

    def create(self, request, *args, **kwargs):
        update_id = request.data.get("updateId")
        issue_id = request.data.get("issueId")
        if not update_id and not issue_id:
            raise ValidationError({"detail": "Either `updateId` or `issueId` is required"})
        if update_id and issue_id:
            raise ValidationError({"detail": "Provide only one between `updateId` and `issueId`"})

        if update_id:
            event = IssueEvent.objects.filter(update_id=update_id).select_related("issue").first()
            if not event:
                return Response(status=status.HTTP_404_NOT_FOUND)
            self._ensure_attachment_write_access(event.issue)
            attachment = create_attachment_for_event(event, request.data)
        else:
            issue = Issue.objects.filter(issue_id=issue_id).select_related("project").first()
            if not issue:
                return Response(status=status.HTTP_404_NOT_FOUND)
            self._ensure_attachment_write_access(issue)
            message = (request.data.get("message", "") or "").strip() or "Attachment uploaded"
            event = create_issue_event_with_attachment(
                issue=issue,
                actor=request.user,
                event_type=EventType.COMMENT,
                message=message,
                payload=request.data,
            )
            attachment = event.attachments.first()

        if not attachment:
            raise ValidationError({"file": "Attachment file is required"})
        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        attachment = self.get_object()
        self._ensure_attachment_write_access(attachment.update.issue)
        delete_media_path(attachment.path)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
