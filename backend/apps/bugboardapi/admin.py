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
    Tag,
    UserImage,
)


@admin.register(UserImage)
class UserImageAdmin(admin.ModelAdmin):
    list_display = ("user", "is_admin", "active")
    list_filter = ("is_admin", "active")
    search_fields = ("user__username", "user__email")


class ProjectMembershipInline(admin.TabularInline):
    model = ProjectMembership
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("project_id", "name", "created_by", "created_at")
    search_fields = ("name", "description")
    inlines = [ProjectMembershipInline]


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(admin.ModelAdmin):
    list_display = ("project_membership_id", "project", "user", "role")
    list_filter = ("role",)
    search_fields = ("project__name", "user__username", "user__email")


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


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("notification_id", "notify_type", "issue", "project", "created_at")
    list_filter = ("notify_type", "created_at")


@admin.register(NotifyUser)
class NotifyUserAdmin(admin.ModelAdmin):
    list_display = ("notify_user_id", "notification", "user", "is_read", "read_at")
    list_filter = ("is_read",)
    search_fields = ("user__username", "user__email")


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ("otp_id", "user", "code", "created_at", "expires_at", "is_used")
    list_filter = ("is_used",)
    search_fields = ("user__username", "user__email", "code")
