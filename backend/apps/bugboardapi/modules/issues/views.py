"""Issue management views."""
from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from ...common.sse import (
    ServerSentEventsRenderer,
    build_sse_response,
    parse_last_event_id,
    stream_sse_events,
)
from ...permissions import (
    check_assignee_or_admin,
    check_admin,
    ensure_issue_access,
    ensure_project_access,
    filter_by_project_access,
)
from ...permissions.scopes import first_by_project_access
from .models import (
    Attachment,
    Issue,
    IssueEvent,
)
from ..projects.models import Project
from ..projects.serializers import ProjectMembershipSerializer
from .serializers import (
    AttachmentSerializer,
    IssueEventSerializer,
    IssueSerializer,
)
from .activity import delete_media_path
from .commands import (
    assign_issue_users,
    create_issue_for_project,
    create_issue_attachment,
    create_issue_comment,
    delete_issue,
    unassign_issue_users,
    update_issue_from_serializer,
    update_issue_status,
    upload_attachment_for_event,
)
from .membership import (
    is_admin_issue_subscribed,
    subscribe_admin_to_issue,
    unsubscribe_admin_from_issue,
)
from .queries import list_issue_suggestion_memberships, list_project_issues_queryset
from .realtime import open_issue_subscription

logger = logging.getLogger(__name__)


def _get_project_or_none(*, user, project_id: int):
    return first_by_project_access(
        queryset=Project.objects.all(),
        user=user,
        lookup={"project_id": project_id},
    )


def _issue_queryset():
    return Issue.objects.select_related("project", "reporter", "reporter__profile").prefetch_related("assignees", "tags")


def _scoped_issue_or_none(*, user, issue_id):
    return first_by_project_access(
        queryset=_issue_queryset(),
        user=user,
        lookup={"issue_id": issue_id},
    )


def _scoped_issue_event_or_none(*, user, update_id):
    return first_by_project_access(
        queryset=IssueEvent.objects.select_related("issue"),
        user=user,
        lookup={"update_id": update_id},
        project_lookup="issue__project_id",
    )


class ProjectIssueListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        project = _get_project_or_none(user=request.user, project_id=project_id)
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        queryset = list_project_issues_queryset(project=project, request=request)
        return Response(IssueSerializer(queryset, many=True, context={"request": request}).data)

    def post(self, request, project_id):
        project = _get_project_or_none(user=request.user, project_id=project_id)
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_project_access(request.user, project)
        serializer = IssueSerializer(data=request.data, context={"request": request, "project": project})
        serializer.is_valid(raise_exception=True)
        issue = create_issue_for_project(serializer=serializer, reporter=request.user, project=project)
        return Response(IssueSerializer(issue, context={"request": request}).data, status=status.HTTP_201_CREATED)


class IssueViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = IssueSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = _issue_queryset()
    lookup_field = "issue_id"
    lookup_url_kwarg = "issue_id"

    def get_queryset(self):
        return filter_by_project_access(queryset=_issue_queryset(), user=self.request.user)

    def perform_destroy(self, instance):
        check_admin(self.request.user)
        ensure_issue_access(self.request.user, instance)
        delete_issue(instance=instance, title_confirmation=self.request.data.get("title"))

    def perform_update(self, serializer):
        update_issue_from_serializer(
            serializer=serializer,
            actor=self.request.user,
            raw_message=self.request.data.get("message", ""),
        )

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, issue_id=None):
        check_admin(request.user)
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        assign_issue_users(issue=issue, actor=request.user, raw_user_ids=request.data.get("userIds", []))
        return Response({"detail": "Issue assigned"})

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, issue_id=None):
        check_admin(request.user)
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        unassign_issue_users(issue=issue, actor=request.user, raw_user_ids=request.data.get("userIds", []))
        return Response({"detail": "Issue unassigned"})

    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, issue_id=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        check_assignee_or_admin(request.user, issue)
        updated_issue = update_issue_status(
            issue=issue,
            actor=request.user,
            new_status=request.data.get("status"),
            raw_message=request.data.get("message", ""),
            payload=request.data,
        )
        return Response(IssueSerializer(updated_issue, context={"request": request}).data)

    @action(detail=True, methods=["get", "post", "delete"], url_path="subscription")
    def subscription(self, request, issue_id=None):
        check_admin(request.user)
        issue = self.get_object()
        ensure_issue_access(request.user, issue)

        if request.method == "GET":
            return Response({
                "subscribed": is_admin_issue_subscribed(issue=issue, user=request.user),
            })

        if request.method == "POST":
            subscribe_admin_to_issue(issue=issue, user=request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)

        unsubscribe_admin_from_issue(issue=issue, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="updates")
    def updates(self, request, issue_id=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)

        if request.method.lower() == "get":
            events = issue.events.select_related("actor").prefetch_related("attachments").all()
            return Response(IssueEventSerializer(events, many=True).data)

        check_assignee_or_admin(request.user, issue)
        event = create_issue_comment(
            issue=issue,
            actor=request.user,
            raw_message=request.data.get("message", ""),
            payload=request.data,
        )
        return Response(IssueEventSerializer(event, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def _load_catchup_events(self, *, issue_id: int, last_seen_id: int) -> list[IssueEvent]:
        return list(
            IssueEvent.objects.select_related("issue", "actor", "actor__profile")
            .prefetch_related("attachments")
            .filter(issue_id=issue_id, update_id__gt=last_seen_id)
            .order_by("update_id")
        )

    def _serialize_catchup_event(self, event: IssueEvent) -> tuple[str, object, int]:
        return (
            "issue.event.created",
            IssueEventSerializer(event).data,
            event.update_id,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="updates/stream",
        renderer_classes=[ServerSentEventsRenderer],
    )
    def updates_stream(self, request, issue_id=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)

        try:
            subscription = open_issue_subscription(issue.issue_id)
        except RuntimeError:
            return Response(
                {"detail": "Issue activity stream unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        last_seen_id = parse_last_event_id(request)
        heartbeat_interval = max(float(getattr(settings, "NOTIFICATIONS_STREAM_HEARTBEAT_SECONDS", 20.0)), 1.0)
        catchup_events = self._load_catchup_events(issue_id=issue.issue_id, last_seen_id=last_seen_id)

        return build_sse_response(
            stream_sse_events(
                catchup_items=catchup_events,
                serialize_catchup_item=self._serialize_catchup_event,
                subscription=subscription,
                last_seen_id=last_seen_id,
                heartbeat_interval=heartbeat_interval,
                on_disconnect=lambda: logger.debug(
                    "issue_event_stream_client_disconnected",
                    extra={"issue_id": issue.issue_id},
                ),
            )
        )

    @action(detail=True, methods=["get"], url_path="suggestions")
    def suggestions(self, request, issue_id=None):
        issue = self.get_object()
        ensure_issue_access(request.user, issue)
        memberships = list_issue_suggestion_memberships(issue=issue)
        payload = ProjectMembershipSerializer(memberships, many=True).data
        open_count_by_user_id = {membership.user_id: membership.open_count for membership in memberships}
        for item in payload:
            item["openCount"] = open_count_by_user_id.get(item["userId"], 0)
        return Response(payload)

    @action(detail=True, methods=["patch"], url_path="details")
    def details(self, request, issue_id=None):
        """Dedicated endpoint for issue edit pages to patch full issue details."""
        return self.partial_update(request, issue_id=issue_id)

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

    def post(self, request, update_id):
        event = _scoped_issue_event_or_none(user=request.user, update_id=update_id)
        if not event:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ensure_issue_access(request.user, event.issue)
        check_assignee_or_admin(request.user, event.issue)
        attachment = upload_attachment_for_event(event=event, payload=request.data)
        return Response(AttachmentSerializer(attachment, context={"request": request}).data, status=status.HTTP_201_CREATED)


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
        queryset = filter_by_project_access(
            queryset=super().get_queryset(),
            user=self.request.user,
            project_lookup="update__issue__project_id",
        )
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
            event = _scoped_issue_event_or_none(user=request.user, update_id=update_id)
            if not event:
                return Response(status=status.HTTP_404_NOT_FOUND)
            self._ensure_attachment_write_access(event.issue)
            attachment = upload_attachment_for_event(event=event, payload=request.data)
        else:
            issue = _scoped_issue_or_none(user=request.user, issue_id=issue_id)
            if not issue:
                return Response(status=status.HTTP_404_NOT_FOUND)
            self._ensure_attachment_write_access(issue)
            attachment = create_issue_attachment(issue=issue, actor=request.user, payload=request.data)

        return Response(AttachmentSerializer(attachment, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        attachment = self.get_object()
        self._ensure_attachment_write_access(attachment.update.issue)
        delete_media_path(attachment.path)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
