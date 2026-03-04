from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Attachment,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueStatus,
    IssueTag,
    NotifyUser,
    Project,
    ProjectMembership,
    Tag,
    UserProfile,
)
from .services import notify_users  # noqa: F401 — re-exported for backward compat
from .utils import build_media_url


class UserSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="id", read_only=True)
    firstName = serializers.CharField(source="first_name", required=False, allow_blank=True)
    lastName = serializers.CharField(source="last_name", required=False, allow_blank=True)
    isAdmin = serializers.BooleanField(source="profile.is_admin", required=False)
    profileImg = serializers.CharField(source="profile.profile_img", required=False, allow_blank=True)
    active = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = User
        fields = [
            "userId",
            "username",
            "email",
            "firstName",
            "lastName",
            "password",
            "isAdmin",
            "profileImg",
            "active",
        ]
        extra_kwargs = {"password": {"write_only": True, "required": False}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["profileImg"] = build_media_url(self, data.get("profileImg", ""))
        return data

    def create(self, validated_data):
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.is_admin = profile_data.get("is_admin", profile.is_admin)
        profile.profile_img = profile_data.get("profile_img", profile.profile_img)
        profile.active = validated_data.get("is_active", profile.active)
        profile.save()
        user.is_staff = profile.is_admin
        user.save(update_fields=["is_staff"])
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if "is_admin" in profile_data:
            profile.is_admin = profile_data["is_admin"]
            instance.is_staff = profile.is_admin
            instance.save(update_fields=["is_staff"])
        if "profile_img" in profile_data:
            profile.profile_img = profile_data["profile_img"]
        profile.active = instance.is_active
        profile.save()
        return instance


class ProjectMembershipSerializer(serializers.ModelSerializer):
    projectMembershipId = serializers.IntegerField(source="project_membership_id", read_only=True)
    projectId = serializers.IntegerField(source="project.project_id", read_only=True)
    userId = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    profileImg = serializers.CharField(source="user.profile.profile_img", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["projectMembershipId", "projectId", "userId", "username", "role", "profileImg"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["profileImg"] = build_media_url(self, data.get("profileImg", ""))
        return data


class ProjectSerializer(serializers.ModelSerializer):
    projectId = serializers.IntegerField(source="project_id", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    createdBy = serializers.IntegerField(source="created_by.id", read_only=True)
    authorProfileImg = serializers.CharField(source="created_by.profile.profile_img", read_only=True)

    class Meta:
        model = Project
        fields = ["projectId", "name", "createdAt", "description", "color", "icon", "createdBy", "authorProfileImg"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["authorProfileImg"] = build_media_url(self, data.get("authorProfileImg", ""))
        return data


class TagSerializer(serializers.ModelSerializer):
    tagId = serializers.IntegerField(source="tag_id", read_only=True)

    class Meta:
        model = Tag
        fields = ["tagId", "name"]


class IssueSerializer(serializers.ModelSerializer):
    issueId = serializers.IntegerField(source="issue_id", read_only=True)
    projectId = serializers.IntegerField(source="project.project_id", read_only=True)
    reporterId = serializers.IntegerField(source="reporter.id", read_only=True)
    reporter = UserSerializer(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    closedAt = serializers.DateTimeField(source="closed_at", read_only=True)
    type = serializers.CharField(source="issue_type")
    assigneeIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1), write_only=True, required=False
    )
    tagIds = serializers.ListField(child=serializers.IntegerField(min_value=1), write_only=True, required=False)
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
            "updatedAt",
            "closedAt",
            "assigneeIds",
            "tagIds",
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
        ]

    def create(self, validated_data):
        assignee_ids = validated_data.pop("assigneeIds", [])
        tag_ids = validated_data.pop("tagIds", [])
        issue = Issue.objects.create(**validated_data)
        for user_id in assignee_ids:
            IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
        for tag_id in tag_ids:
            IssueTag.objects.get_or_create(issue=issue, tag_id=tag_id)
        return issue

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop("assigneeIds", None)
        tag_ids = validated_data.pop("tagIds", None)
        if "issue_type" in validated_data:
            instance.issue_type = validated_data.pop("issue_type")
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if instance.status == IssueStatus.DONE and instance.closed_at is None:
            instance.closed_at = timezone.now()
        if instance.status != IssueStatus.DONE:
            instance.closed_at = None
        instance.save()

        if assignee_ids is not None:
            IssueAssignee.objects.filter(issue=instance).exclude(user_id__in=assignee_ids).delete()
            for user_id in assignee_ids:
                IssueAssignee.objects.get_or_create(issue=instance, user_id=user_id)

        if tag_ids is not None:
            IssueTag.objects.filter(issue=instance).exclude(tag_id__in=tag_ids).delete()
            for tag_id in tag_ids:
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
    mimeType = serializers.CharField(source="mime_type")
    uploadedAt = serializers.DateTimeField(source="uploaded_at", read_only=True)

    class Meta:
        model = Attachment
        fields = ["attachmentId", "updateId", "path", "mimeType", "size", "uploadedAt"]


class NotifyUserSerializer(serializers.ModelSerializer):
    notifyUserId = serializers.IntegerField(source="notify_user_id", read_only=True)
    notificationId = serializers.IntegerField(source="notification.notification_id", read_only=True)
    isRead = serializers.BooleanField(source="is_read")
    readAt = serializers.DateTimeField(source="read_at", read_only=True)
    type = serializers.CharField(source="notification.notify_type", read_only=True)
    createdAt = serializers.DateTimeField(source="notification.created_at", read_only=True)
    issueId = serializers.SerializerMethodField(read_only=True)
    projectId = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = NotifyUser
        fields = [
            "notifyUserId",
            "notificationId",
            "type",
            "createdAt",
            "issueId",
            "projectId",
            "isRead",
            "readAt",
        ]

    def get_issueId(self, obj):
        issue = getattr(obj.notification, "issue", None)
        return getattr(issue, "issue_id", None)

    def get_projectId(self, obj):
        project = getattr(obj.notification, "project", None)
        return getattr(project, "project_id", None)


class PasswordOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordOTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")
    newPassword = serializers.CharField(min_length=8)


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=False, allow_blank=True)
    newPassword = serializers.CharField(min_length=8)
