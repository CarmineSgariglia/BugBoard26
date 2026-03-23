from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import NotifyUser


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
        fields = ["notifyUserId", "notificationId", "type", "createdAt", "issueId", "projectId", "isRead", "readAt"]

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_issueId(self, obj) -> int | None:
        issue = getattr(obj.notification, "issue", None)
        return getattr(issue, "issue_id", None)

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_projectId(self, obj) -> int | None:
        project = getattr(obj.notification, "project", None)
        return getattr(project, "project_id", None)


class NotificationsPageSerializer(serializers.Serializer):
    results = NotifyUserSerializer(many=True)
    nextCursor = serializers.IntegerField(allow_null=True)
    hasMore = serializers.BooleanField()
    hasUnread = serializers.BooleanField()


class NotificationReadAllResponseSerializer(serializers.Serializer):
    updated = serializers.IntegerField()
