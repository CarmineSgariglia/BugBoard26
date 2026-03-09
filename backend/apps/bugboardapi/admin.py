from django.contrib import admin

from .models import (
    Attachment,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueTag,
    Notification,
    NotifyUser,
    PasswordResetOTP,
    Project,
    ProjectMembership,
    RevokedTokenSession,
    Tag,
    UserProfileImage,
)


@admin.register(UserProfileImage)
class UserProfileImageAdmin(admin.ModelAdmin):
    list_display = ("user", "profile_img")
    search_fields = ("user__username", "user__email")


class ProjectMembershipInline(admin.TabularInline):
    model = ProjectMembership
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("project_id", "name", "created_by", "created_at")
    search_fields = ("name", "description")
    inlines = [ProjectMembershipInline]


class IssueAssigneeInline(admin.TabularInline):
    model = IssueAssignee
    extra = 0


class IssueTagInline(admin.TabularInline):
    model = IssueTag
    extra = 0


@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = ("issue_id", "title", "project", "status", "priority", "reporter", "created_at")
    list_filter = ("status", "priority", "issue_type")
    search_fields = ("title", "description", "project__name")
    inlines = [IssueAssigneeInline, IssueTagInline]


@admin.register(IssueEvent)
class IssueEventAdmin(admin.ModelAdmin):
    list_display = ("update_id", "issue", "event_type", "actor", "at")
    list_filter = ("event_type", "at")
    search_fields = ("issue__title", "actor__username", "message")


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("attachment_id", "update", "mime_type", "size", "uploaded_at")
    search_fields = ("path", "mime_type")




@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("tag_id", "name")
    search_fields = ("name",)


class NotifyUserInline(admin.TabularInline):
    model = NotifyUser
    extra = 0


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("notification_id", "notify_type", "issue", "project", "created_at")
    list_filter = ("notify_type", "created_at")
    inlines = [NotifyUserInline]




@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ("otp_id", "user", "code", "created_at", "expires_at", "is_used")
    list_filter = ("is_used",)
    search_fields = ("user__username", "user__email", "code")


@admin.register(RevokedTokenSession)
class RevokedTokenSessionAdmin(admin.ModelAdmin):
    list_display = ("sid", "user", "expires_at", "revoked_at")
    list_filter = ("revoked_at",)
    search_fields = ("sid", "user__username", "user__email")
