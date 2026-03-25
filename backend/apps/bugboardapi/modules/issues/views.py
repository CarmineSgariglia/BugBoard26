"""Issue management views."""
from __future__ import annotations

import logging

from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, OpenApiTypes, extend_schema, extend_schema_view, inline_serializer
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers

from ...common.sse import (
    ServerSentEventsRenderer,
    build_sse_response,
    parse_last_event_id,
    stream_sse_events,
)
from ...permissions import (
    filter_by_project_access,
    require_admin,
    require_assignee_or_admin,
    require_project_access,
)
from ...permissions.scopes import first_by_project_access
from .models import (
    Attachment,
    Issue,
    IssueEvent,
)
from ..projects.models import Project
from .serializers import (
    AttachmentSerializer,
    IssueEventSerializer,
    IssueSuggestionSerializer,
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

issue_subscription_state_serializer = inline_serializer(
    name="IssueSubscriptionState",
    fields={"subscribed": serializers.BooleanField()},
)

issue_update_json_request_serializer = inline_serializer(
    name="IssueUpdateJsonRequest",
    fields={"message": serializers.CharField()},
)

issue_update_multipart_request_serializer = inline_serializer(
    name="IssueUpdateMultipartRequest",
    fields={
        "message": serializers.CharField(),
        "file": serializers.ListField(child=serializers.FileField(), required=False),
    },
)

issue_event_attachment_upload_request_serializer = inline_serializer(
    name="IssueEventAttachmentUploadRequest",
    fields={"file": serializers.FileField()},
)

issue_attachment_create_request_serializer = inline_serializer(
    name="IssueAttachmentCreateRequest",
    fields={
        "message": serializers.CharField(required=False, allow_blank=True),
        "file": serializers.FileField(),
    },
)


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


def _scoped_issue_event_or_none(*, user, event_id):
    return first_by_project_access(
        queryset=IssueEvent.objects.select_related("issue"),
        user=user,
        lookup={"update_id": event_id},
        project_lookup="issue__project_id",
    )


class ProjectIssueListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(tags=["Issues"], responses=IssueSerializer(many=True))
    def get(self, request, projectId):
        project = _get_project_or_none(user=request.user, project_id=projectId)
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        require_project_access(request.user, project)
        queryset = list_project_issues_queryset(project=project, request=request)
        return Response(IssueSerializer(queryset, many=True, context={"request": request}).data)

    @extend_schema(tags=["Issues"], request=IssueSerializer, responses={201: IssueSerializer})
    def post(self, request, projectId):
        project = _get_project_or_none(user=request.user, project_id=projectId)
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)
        require_project_access(request.user, project)
        serializer = IssueSerializer(data=request.data, context={"request": request, "project": project})
        serializer.is_valid(raise_exception=True)
        issue = create_issue_for_project(serializer=serializer, reporter=request.user, project=project)
        return Response(IssueSerializer(issue, context={"request": request}).data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    retrieve=extend_schema(tags=["Issues"], responses=IssueSerializer),
    partial_update=extend_schema(tags=["Issues"], responses=IssueSerializer),
    update=extend_schema(tags=["Issues"], responses=IssueSerializer),
    destroy=extend_schema(
        tags=["Issues"],
        description="Deletes the issue. No request body is required or documented in Phase 1.",
        request=None,
        responses={204: OpenApiResponse(description="Issue deleted")},
    ),
)
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
    lookup_url_kwarg = "issueId"

    def get_queryset(self):
        return filter_by_project_access(queryset=_issue_queryset(), user=self.request.user)

    def perform_destroy(self, instance):
        require_admin(self.request.user)
        require_project_access(self.request.user, instance.project)
        delete_issue(instance=instance)

    def perform_update(self, serializer):
        update_issue_from_serializer(
            serializer=serializer,
            actor=self.request.user,
            raw_message=self.request.data.get("message", ""),
        )

    @action(detail=True, methods=["get", "put", "delete"], url_path="subscriptions/me")
    @extend_schema(
        tags=["Issues"],
        description="Admin subscription state for the authenticated user on the issue.",
        request=None,
        responses={
            200: issue_subscription_state_serializer,
            204: OpenApiResponse(description="Subscription updated"),
        },
    )
    def subscription(self, request, issueId=None):
        require_admin(request.user)
        issue = self.get_object()
        require_project_access(request.user, issue.project)

        if request.method == "GET":
            return Response({
                "subscribed": is_admin_issue_subscribed(issue=issue, user=request.user),
            })

        if request.method == "PUT":
            subscribe_admin_to_issue(issue=issue, user=request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)

        unsubscribe_admin_from_issue(issue=issue, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="events")
    @extend_schema(
        tags=["Issues"],
        description="Issue activity events.",
        request={
            "application/json": issue_update_json_request_serializer,
            "multipart/form-data": issue_update_multipart_request_serializer,
        },
        responses={200: IssueEventSerializer(many=True), 201: IssueEventSerializer},
    )
    def events(self, request, issueId=None):
        issue = self.get_object()
        require_project_access(request.user, issue.project)

        if request.method.lower() == "get":
            events = issue.events.select_related("actor").prefetch_related("attachments").all()
            return Response(IssueEventSerializer(events, many=True).data)

        require_assignee_or_admin(request.user, issue)
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
        url_path="events/stream",
        renderer_classes=[ServerSentEventsRenderer],
    )
    @extend_schema(
        tags=["Issues"],
        description="Server-Sent Events activity stream for the issue.",
        responses={(200, "text/event-stream"): OpenApiTypes.STR},
    )
    def events_stream(self, request, issueId=None):
        issue = self.get_object()
        require_project_access(request.user, issue.project)

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
    @extend_schema(tags=["Issues"], responses=IssueSuggestionSerializer(many=True))
    def suggestions(self, request, issueId=None):
        issue = self.get_object()
        require_project_access(request.user, issue.project)
        memberships = list_issue_suggestion_memberships(issue=issue)
        return Response(IssueSuggestionSerializer(memberships, many=True).data)

    def partial_update(self, request, *args, **kwargs):
        issue = self.get_object()
        require_project_access(request.user, issue.project)
        require_assignee_or_admin(request.user, issue)
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        issue = self.get_object()
        require_project_access(request.user, issue.project)
        require_assignee_or_admin(request.user, issue)
        return super().update(request, *args, **kwargs)


class IssueAssigneeDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Issues"],
        summary="Assign issue user",
        request=None,
        responses={204: OpenApiResponse(description="Assignee added")},
    )
    def put(self, request, issueId, userId):
        issue = _scoped_issue_or_none(user=request.user, issue_id=issueId)
        if not issue:
            return Response(status=status.HTTP_404_NOT_FOUND)
        require_admin(request.user)
        require_project_access(request.user, issue.project)
        assign_issue_users(issue=issue, actor=request.user, raw_user_ids=[userId])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        tags=["Issues"],
        summary="Unassign issue user",
        request=None,
        responses={204: OpenApiResponse(description="Assignee removed")},
    )
    def delete(self, request, issueId, userId):
        issue = _scoped_issue_or_none(user=request.user, issue_id=issueId)
        if not issue:
            return Response(status=status.HTTP_404_NOT_FOUND)
        require_admin(request.user)
        require_project_access(request.user, issue.project)
        unassign_issue_users(issue=issue, actor=request.user, raw_user_ids=[userId])
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueAttachmentCollectionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _ensure_attachment_write_access(self, issue: Issue) -> None:
        require_project_access(self.request.user, issue.project)
        require_assignee_or_admin(self.request.user, issue)

    @extend_schema(
        tags=["Attachments"],
        responses=AttachmentSerializer(many=True),
    )
    def get(self, request, issueId):
        issue = _scoped_issue_or_none(user=request.user, issue_id=issueId)
        if not issue:
            return Response(status=status.HTTP_404_NOT_FOUND)
        require_project_access(request.user, issue.project)
        attachments = (
            Attachment.objects.select_related("update", "update__issue")
            .filter(update__issue=issue)
            .order_by("-uploaded_at")
        )
        return Response(AttachmentSerializer(attachments, many=True, context={"request": request}).data)

    @extend_schema(
        tags=["Attachments"],
        request={"multipart/form-data": issue_attachment_create_request_serializer},
        responses={201: AttachmentSerializer},
    )
    def post(self, request, issueId):
        issue = _scoped_issue_or_none(user=request.user, issue_id=issueId)
        if not issue:
            return Response(status=status.HTTP_404_NOT_FOUND)
        self._ensure_attachment_write_access(issue)
        attachment = create_issue_attachment(issue=issue, actor=request.user, payload=request.data)
        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class IssueEventAttachmentCollectionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(
        tags=["Attachments"],
        request={"multipart/form-data": issue_event_attachment_upload_request_serializer},
        responses={201: AttachmentSerializer},
    )
    def post(self, request, issueId, eventId):
        issue = _scoped_issue_or_none(user=request.user, issue_id=issueId)
        if not issue:
            return Response(status=status.HTTP_404_NOT_FOUND)
        event = _scoped_issue_event_or_none(user=request.user, event_id=eventId)
        if not event or event.issue_id != issue.issue_id:
            return Response(status=status.HTTP_404_NOT_FOUND)
        require_project_access(request.user, issue.project)
        require_assignee_or_admin(request.user, issue)
        attachment = upload_attachment_for_event(event=event, payload=request.data)
        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class IssueAttachmentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Attachments"],
        request=None,
        responses={204: OpenApiResponse(description="Attachment deleted")},
    )
    def delete(self, request, issueId, attachmentId):
        issue = _scoped_issue_or_none(user=request.user, issue_id=issueId)
        if not issue:
            return Response(status=status.HTTP_404_NOT_FOUND)
        attachment = (
            Attachment.objects.select_related("update", "update__issue")
            .filter(
                attachment_id=attachmentId,
                update__issue=issue,
            )
            .first()
        )
        if attachment is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        require_project_access(request.user, issue.project)
        require_assignee_or_admin(request.user, issue)
        delete_media_path(attachment.path)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
