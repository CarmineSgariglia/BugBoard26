from drf_spectacular.utils import extend_schema_field, inline_serializer
from rest_framework import serializers

from ...common.media import build_media_url
from ...roles import is_admin_user
from ..tags.serializers import TagSerializer
from ..tags.services import validate_existing_tag_ids
from ..projects.serializers import ProjectMembershipSerializer
from ..users.serializers import UserReadSerializer
from .mutations import (
    create_issue_from_validated_data,
    update_issue_from_validated_data,
)
from .models import Attachment, Issue, IssueEvent, IssueStatus
from .rules import validate_project_assignee_ids


class IssueSerializer(serializers.ModelSerializer):
    issueId = serializers.IntegerField(source="issue_id", read_only=True)
    projectId = serializers.IntegerField(source="project.project_id", read_only=True)
    reporterId = serializers.IntegerField(source="reporter.id", read_only=True)
    reporter = UserReadSerializer(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    type = serializers.CharField(source="issue_type")
    assigneeIds = serializers.ListField(child=serializers.IntegerField(min_value=1), write_only=True, required=False)
    tagIds = serializers.ListField(child=serializers.IntegerField(min_value=1), write_only=True, required=False)
    tagNames = serializers.ListField(
        child=serializers.CharField(max_length=16, allow_blank=False, trim_whitespace=True),
        write_only=True,
        required=False,
    )
    assignees = serializers.SerializerMethodField(read_only=True)
    tags = TagSerializer(read_only=True, many=True)

    class Meta:
        model = Issue
        fields = [
            "issueId",
            "projectId",
            "reporterId",
            "reporter",
            "title",
            "description",
            "type",
            "status",
            "priority",
            "createdAt",

            "assigneeIds",
            "tagIds",
            "tagNames",
            "assignees",
            "tags",
        ]

    @extend_schema_field(
        inline_serializer(
            name="IssueAssignee",
            fields={
                "userId": serializers.IntegerField(),
                "username": serializers.CharField(),
                "profileImg": serializers.CharField(allow_blank=True, allow_null=True),
            },
            many=True,
        )
    )
    def get_assignees(self, obj):
        return [
            {
                "userId": user.id,
                "username": user.username,
                "profileImg": build_media_url(getattr(getattr(user, "profile", None), "profile_img", "")),
            }
            for user in obj.assignees.all()
            if not is_admin_user(user)
        ]

    def validate(self, attrs):
        assignee_ids = attrs.get("assigneeIds")
        project = self.context.get("project") or getattr(self.instance, "project", None)
        if project is not None:
            validate_project_assignee_ids(project=project, assignee_ids=assignee_ids)

        tag_ids = attrs.get("tagIds")
        validate_existing_tag_ids(tag_ids)

        return attrs

    def create(self, validated_data):
        return create_issue_from_validated_data(validated_data)

    def update(self, instance, validated_data):
        return update_issue_from_validated_data(instance, validated_data)


class AttachmentSerializer(serializers.ModelSerializer):
    attachmentId = serializers.IntegerField(source="attachment_id", read_only=True)
    updateId = serializers.IntegerField(source="update.update_id", read_only=True)
    originalName = serializers.CharField(source="original_name", read_only=True)
    mimeType = serializers.CharField(source="mime_type")
    uploadedAt = serializers.DateTimeField(source="uploaded_at", read_only=True)
    url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Attachment
        fields = ["attachmentId", "updateId", "originalName", "path", "url", "mimeType", "size", "uploadedAt"]

    @extend_schema_field(serializers.CharField())
    def get_url(self, obj) -> str:
        return build_media_url(obj.path)


class IssueEventSerializer(serializers.ModelSerializer):
    updateId = serializers.IntegerField(source="update_id", read_only=True)
    issueId = serializers.IntegerField(source="issue.issue_id", read_only=True)
    actorId = serializers.IntegerField(source="actor.id", read_only=True)
    actorUsername = serializers.CharField(source="actor.username", read_only=True)
    actorFirstName = serializers.CharField(source="actor.first_name", read_only=True)
    actorLastName = serializers.CharField(source="actor.last_name", read_only=True)
    eventType = serializers.CharField(source="event_type")
    oldStatus = serializers.CharField(source="old_status", required=False, allow_blank=True)
    newStatus = serializers.CharField(source="new_status", required=False, allow_blank=True)
    attachments = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = IssueEvent
        fields = [
            "updateId", "issueId", "actorId", "actorUsername",
            "actorFirstName", "actorLastName",
            "eventType", "at", "message", "oldStatus", "newStatus", "attachments"
        ]

    @extend_schema_field(AttachmentSerializer(many=True))
    def get_attachments(self, obj) -> list[dict[str, object]]:
        return AttachmentSerializer(obj.attachments.all(), many=True).data


class IssueSuggestionSerializer(ProjectMembershipSerializer):
    openCount = serializers.IntegerField(source="open_count")

    class Meta(ProjectMembershipSerializer.Meta):
        fields = [*ProjectMembershipSerializer.Meta.fields, "openCount"]
