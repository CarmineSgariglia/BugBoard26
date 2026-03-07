from rest_framework import serializers

from ..models import NotifyUser


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

    def get_issueId(self, obj):
        issue = getattr(obj.notification, "issue", None)
        return getattr(issue, "issue_id", None)

    def get_projectId(self, obj):
        project = getattr(obj.notification, "project", None)
        return getattr(project, "project_id", None)
