from rest_framework import serializers

from ...common.media import build_media_url
from ...roles import DEVELOPER_GROUP_NAME, get_global_role
from .models import Project, ProjectMembership


class ProjectMembershipSerializer(serializers.ModelSerializer):
    projectMembershipId = serializers.IntegerField(source="project_membership_id", read_only=True)
    projectId = serializers.IntegerField(source="project.project_id", read_only=True)
    userId = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    firstName = serializers.CharField(source="user.first_name", read_only=True)
    lastName = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    profileImg = serializers.CharField(source="user.profile.profile_img", read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMembership
        fields = ["projectMembershipId", "projectId", "userId", "username", "firstName", "lastName", "email", "role", "profileImg"]

    def get_role(self, instance):
        return get_global_role(instance.user) or DEVELOPER_GROUP_NAME

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
