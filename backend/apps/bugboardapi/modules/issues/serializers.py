from rest_framework import serializers

from ...common.media import build_media_url
from ...roles import is_admin_user
from ..tags.models import Tag
from ..tags.serializers import TagSerializer
from ..users.serializers import UserSerializer
from .models import Attachment, Issue, IssueAssignee, IssueEvent, IssueStatus, IssueTag
from .rules import validate_project_assignee_ids


class IssueSerializer(serializers.ModelSerializer):
    issueId = serializers.IntegerField(source="issue_id", read_only=True)
    projectId = serializers.IntegerField(source="project.project_id", read_only=True)
    reporterId = serializers.IntegerField(source="reporter.id", read_only=True)
    reporter = UserSerializer(read_only=True)
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

    def get_assignees(self, obj):
        return [
            {
                "userId": user.id,
                "username": user.username,
                "profileImg": build_media_url(self, getattr(getattr(user, "profile", None), "profile_img", "")),
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
        if tag_ids is not None:
            existing_tag_ids = set(Tag.objects.filter(tag_id__in=tag_ids).values_list("tag_id", flat=True))
            missing_tag_ids = [tag_id for tag_id in tag_ids if tag_id not in existing_tag_ids]
            if missing_tag_ids:
                raise serializers.ValidationError({"tagIds": f"Invalid tag ids: {missing_tag_ids}"})

        return attrs

    def _resolve_tag_ids(self, *, tag_ids: list[int], tag_names: list[str]) -> list[int]:
        resolved: list[int] = []
        seen: set[int] = set()

        if tag_ids:
            existing_tag_ids = set(Tag.objects.filter(tag_id__in=tag_ids).values_list("tag_id", flat=True))
            missing_tag_ids = [tag_id for tag_id in tag_ids if tag_id not in existing_tag_ids]
            if missing_tag_ids:
                raise serializers.ValidationError({"tagIds": f"Invalid tag ids: {missing_tag_ids}"})
            for tag_id in tag_ids:
                if tag_id not in seen:
                    seen.add(tag_id)
                    resolved.append(tag_id)

        for raw_name in tag_names:
            name = Tag.normalize_name(raw_name)
            if not name:
                continue
            tag = Tag.objects.filter(name__iexact=name).order_by("tag_id").first()
            if not tag:
                tag, _ = Tag.objects.get_or_create(name=name)
            if tag.tag_id not in seen:
                seen.add(tag.tag_id)
                resolved.append(tag.tag_id)

        return resolved

    def create(self, validated_data):
        assignee_ids = validated_data.pop("assigneeIds", [])
        tag_ids = validated_data.pop("tagIds", [])
        tag_names = validated_data.pop("tagNames", [])
        resolved_tag_ids = self._resolve_tag_ids(tag_ids=tag_ids, tag_names=tag_names)
        issue = Issue.objects.create(**validated_data)
        for user_id in assignee_ids:
            IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
        for tag_id in resolved_tag_ids:
            IssueTag.objects.get_or_create(issue=issue, tag_id=tag_id)
        return issue

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop("assigneeIds", None)
        tag_ids = validated_data.pop("tagIds", None)
        tag_names = validated_data.pop("tagNames", None)
        if "issue_type" in validated_data:
            instance.issue_type = validated_data.pop("issue_type")
        for key, value in validated_data.items():
            setattr(instance, key, value)
       
        instance.save()

        if assignee_ids is not None:
            IssueAssignee.objects.filter(issue=instance).exclude(user_id__in=assignee_ids).delete()
            for user_id in assignee_ids:
                IssueAssignee.objects.get_or_create(issue=instance, user_id=user_id)

        if tag_ids is not None or tag_names is not None:
            resolved_tag_ids = self._resolve_tag_ids(tag_ids=tag_ids or [], tag_names=tag_names or [])
            IssueTag.objects.filter(issue=instance).exclude(tag_id__in=resolved_tag_ids).delete()
            for tag_id in resolved_tag_ids:
                IssueTag.objects.get_or_create(issue=instance, tag_id=tag_id)

        return instance


class IssueEventSerializer(serializers.ModelSerializer):
    updateId = serializers.IntegerField(source="update_id", read_only=True)
    issueId = serializers.IntegerField(source="issue.issue_id", read_only=True)
    actorId = serializers.IntegerField(source="actor.id", read_only=True)
    actorUsername = serializers.CharField(source="actor.username", read_only=True)
    eventType = serializers.CharField(source="event_type")
    oldStatus = serializers.CharField(source="old_status", required=False, allow_blank=True)
    newStatus = serializers.CharField(source="new_status", required=False, allow_blank=True)
    attachments = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = IssueEvent
        fields = ["updateId", "issueId", "actorId", "actorUsername", "eventType", "at", "message", "oldStatus", "newStatus", "attachments"]

    def get_attachments(self, obj):
        return AttachmentSerializer(obj.attachments.all(), many=True).data


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

    def get_url(self, obj):
        return build_media_url(self, obj.path)
