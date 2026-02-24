from __future__ import annotations

import random
from datetime import timedelta

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Attachment,
    EventType,
    Issue,
    IssueAssignee,
    IssueEvent,
    IssueStatus,
    IssueTag,
    NotifyType,
    NotifyUser,
    PasswordResetOTP,
    Priority,
    Project,
    ProjectMembership,
    Tag,
    UserProfile,
)
from .serializers import (
    AttachmentSerializer,
    IssueEventSerializer,
    IssueSerializer,
    NotifyUserSerializer,
    PasswordOTPRequestSerializer,
    PasswordOTPVerifySerializer,
    PasswordResetSerializer,
    ProjectMembershipSerializer,
    ProjectSerializer,
    TagSerializer,
    UserSerializer,
    notify_users,
)


def is_admin(user: User) -> bool:
    if not user.is_authenticated:
        return False
    profile = getattr(user, "profile", None)
    return user.is_superuser or user.is_staff or bool(profile and profile.is_admin)


def check_admin(user: User) -> None:
    if not is_admin(user):
        raise PermissionDenied("Admin privileges required")


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")
        user = User.objects.filter(email__iexact=email).first()
        username = user.username if user else ""
        auth_user = authenticate(request, username=username, password=password)
        if auth_user is None or not auth_user.is_active:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, auth_user)
        return Response(UserSerializer(auth_user).data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class PasswordOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"detail": "If the email exists, an OTP has been sent."})

        code = f"{random.randint(0, 999999):06d}"
        PasswordResetOTP.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        send_mail(
            subject="BugBoard26 OTP Reset",
            message=f"Your OTP code is {code}. It expires in 5 minutes.",
            from_email=None,
            recipient_list=[email],
            fail_silently=True,
        )
        return Response({"detail": "If the email exists, an OTP has been sent."})


class PasswordOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"valid": False})

        otp = (
            PasswordResetOTP.objects.filter(user=user, code=code, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp or not otp.is_valid():
            return Response({"valid": False})
        return Response({"valid": True, "expiresAt": otp.expires_at})


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["newPassword"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

        otp = (
            PasswordResetOTP.objects.filter(user=user, code=code, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp or not otp.is_valid():
            return Response({"detail": "Invalid or expired OTP"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        return Response({"detail": "Password reset completed"})


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.all().order_by("id")
    lookup_field = "id"
    lookup_url_kwarg = "userId"

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )
        return queryset

    def perform_create(self, serializer):
        check_admin(self.request.user)
        serializer.save()

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if request.user != user and not is_admin(request.user):
            raise PermissionDenied("Cannot edit other users")
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="disable")
    def disable(self, request, userId=None):
        check_admin(request.user)
        user = self.get_object()
        username = request.data.get("username", "")
        if username != user.username:
            return Response({"detail": "Username confirmation mismatch"}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = False
        user.save(update_fields=["is_active"])
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.active = False
        profile.save(update_fields=["active"])
        return Response({"detail": "User disabled"})


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Project.objects.select_related("created_by").all()
    lookup_field = "project_id"
    lookup_url_kwarg = "projectId"

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(name__icontains=q)
        return queryset

    def perform_create(self, serializer):
        check_admin(self.request.user)
        with transaction.atomic():
            project = serializer.save(created_by=self.request.user)
            ProjectMembership.objects.get_or_create(
                project=project,
                user=self.request.user,
                defaults={"role": ProjectMembership.Role.ADMIN},
            )
            user_ids = request_user_ids(self.request.data.get("userIds", []))
            users = User.objects.filter(id__in=user_ids, is_active=True)
            members = []
            for user in users:
                member, _ = ProjectMembership.objects.get_or_create(
                    project=project,
                    user=user,
                    defaults={"role": ProjectMembership.Role.DEVELOPER},
                )
                members.append(member.user)
            if members:
                notify_users(notify_type=NotifyType.PROJECT_ADDED, users=members, project=project)

    def update(self, request, *args, **kwargs):
        check_admin(request.user)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        check_admin(request.user)
        project = self.get_object()
        confirm_name = request.data.get("name")
        if confirm_name and confirm_name != project.name:
            return Response({"detail": "Project name confirmation mismatch"}, status=status.HTTP_400_BAD_REQUEST)

        recipient_users = list(User.objects.filter(project_memberships__project=project).distinct())
        if recipient_users:
            notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=recipient_users, project=project)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, projectId=None):
        project = self.get_object()
        if request.method == "GET":
            memberships = ProjectMembership.objects.filter(project=project).select_related("user")
            return Response(ProjectMembershipSerializer(memberships, many=True).data)

        check_admin(request.user)
        user_id = request.data.get("userId")
        if not user_id:
            raise ValidationError({"userId": "This field is required"})
        role = request.data.get("role", ProjectMembership.Role.DEVELOPER)
        membership, created = ProjectMembership.objects.get_or_create(
            project=project,
            user_id=user_id,
            defaults={"role": role},
        )
        if not created:
            membership.role = role
            membership.save(update_fields=["role"])
        notify_users(notify_type=NotifyType.PROJECT_ADDED, users=[membership.user], project=project)
        return Response(ProjectMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"members/(?P<userId>[^/.]+)")
    def remove_member(self, request, projectId=None, userId=None):
        check_admin(request.user)
        project = self.get_object()
        membership = ProjectMembership.objects.filter(project=project, user_id=userId).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)
        user = membership.user
        membership.delete()
        notify_users(notify_type=NotifyType.PROJECT_REMOVED, users=[user], project=project)
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueViewSet(viewsets.ModelViewSet):
    serializer_class = IssueSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Issue.objects.select_related("project", "reporter").prefetch_related("assignees", "tags")
    lookup_field = "issue_id"
    lookup_url_kwarg = "issueId"

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get("projectId")
        q = self.request.query_params.get("q")
        category = self.request.query_params.get("category")
        priority = self.request.query_params.get("priority")
        tag = self.request.query_params.get("tag")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if q:
            queryset = queryset.filter(title__icontains=q)
        if category:
            queryset = queryset.filter(issue_type=category)
        if priority:
            queryset = queryset.filter(priority=priority)
        if tag:
            queryset = queryset.filter(tags__name__iexact=tag)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset.distinct()

    def perform_create(self, serializer):
        project_id = self.request.data.get("projectId") or self.request.query_params.get("projectId")
        project = Project.objects.filter(project_id=project_id).first()
        if not project:
            raise ValidationError({"projectId": "Valid projectId is required"})
        issue = serializer.save(project=project, reporter=self.request.user)
        IssueEvent.objects.create(issue=issue, actor=self.request.user, event_type=EventType.CREATE, message="Issue created")

        admins = User.objects.filter(project_memberships__project=project, project_memberships__role=ProjectMembership.Role.ADMIN)
        notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=list(admins), issue=issue)

    def perform_destroy(self, instance):
        check_admin(self.request.user)
        title = self.request.data.get("title")
        if title and title != instance.title:
            raise ValidationError({"title": "Issue title confirmation mismatch"})
        recipients = list(User.objects.filter(issue_assignments__issue=instance).distinct())
        if recipients:
            notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=instance)
        instance.delete()

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, issueId=None):
        check_admin(request.user)
        issue = self.get_object()
        user_ids = request_user_ids(request.data.get("userIds", []))
        if not user_ids:
            raise ValidationError({"userIds": "At least one userId is required"})

        assigned_users = []
        for user_id in user_ids:
            assignment, _ = IssueAssignee.objects.get_or_create(issue=issue, user_id=user_id)
            assigned_users.append(assignment.user)

        IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.ASSIGN, message="Assignees updated")
        notify_users(notify_type=NotifyType.ISSUE_ASSIGNED, users=assigned_users, issue=issue)
        return Response({"detail": "Issue assigned"})

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, issueId=None):
        check_admin(request.user)
        issue = self.get_object()
        user_ids = request_user_ids(request.data.get("userIds", []))
        if not user_ids:
            raise ValidationError({"userIds": "At least one userId is required"})
        users = list(User.objects.filter(id__in=user_ids))
        IssueAssignee.objects.filter(issue=issue, user_id__in=user_ids).delete()
        IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.UNASSIGN, message="Assignees removed")
        if users:
            notify_users(notify_type=NotifyType.ISSUE_UNASSIGNED, users=users, issue=issue)
        return Response({"detail": "Issue unassigned"})

    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, issueId=None):
        issue = self.get_object()
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=issue, user=request.user).exists()):
            raise PermissionDenied("Only assigned users or admins can change status")

        new_status = request.data.get("status")
        if new_status not in dict(IssueStatus.choices):
            raise ValidationError({"status": "Invalid status"})

        old_status = issue.status
        issue.status = new_status
        issue.closed_at = timezone.now() if new_status == IssueStatus.DONE else None
        issue.save(update_fields=["status", "closed_at", "updated_at"])

        message = request.data.get("message", "")
        event = IssueEvent.objects.create(
            issue=issue,
            actor=request.user,
            event_type=EventType.STATUS_CHANGE,
            message=message,
            old_status=old_status,
            new_status=new_status,
        )
        maybe_create_attachment(event, request.data)

        if new_status == IssueStatus.DONE:
            notify_users(notify_type=NotifyType.ISSUE_CLOSED, users=[issue.reporter], issue=issue)
        return Response(IssueSerializer(issue).data)

    @action(detail=True, methods=["post"], url_path="updates")
    def add_update(self, request, issueId=None):
        issue = self.get_object()
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=issue, user=request.user).exists()):
            raise PermissionDenied("Only assigned users or admins can add updates")

        message = request.data.get("message", "")
        if not message:
            raise ValidationError({"message": "message is required"})

        event = IssueEvent.objects.create(issue=issue, actor=request.user, event_type=EventType.COMMENT, message=message)
        maybe_create_attachment(event, request.data)

        recipients = list(User.objects.filter(issue_assignments__issue=issue).exclude(id=request.user.id).distinct())
        if recipients:
            notify_users(notify_type=NotifyType.ISSUE_UPDATED, users=recipients, issue=issue)

        return Response(IssueEventSerializer(event).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="suggestions")
    def suggestions(self, request, issueId=None):
        issue = self.get_object()
        member_counts = (
            User.objects.filter(project_memberships__project=issue.project)
            .annotate(
                open_count=Count(
                    "issue_assignments",
                    filter=Q(issue_assignments__issue__status__in=[IssueStatus.TODO, IssueStatus.IN_PROGRESS]),
                )
            )
            .order_by("open_count", "username")
        )
        payload = [
            {
                "userId": user.id,
                "username": user.username,
                "suggestionScore": max(0, 100 - user.open_count * 10),
                "openAssignments": user.open_count,
            }
            for user in member_counts
        ]
        return Response(payload)


class AttachmentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, updateId):
        event = IssueEvent.objects.filter(update_id=updateId).first()
        if not event:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not (is_admin(request.user) or IssueAssignee.objects.filter(issue=event.issue, user=request.user).exists()):
            raise PermissionDenied("Not allowed")

        attachment = maybe_create_attachment(event, request.data)
        if not attachment:
            raise ValidationError({"path": "path is required"})
        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotifyUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = NotifyUser.objects.select_related("notification", "notification__issue", "notification__project")
    lookup_field = "notify_user_id"
    lookup_url_kwarg = "notificationId"

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, notificationId=None):
        notify_user = self.get_object()
        notify_user.is_read = True
        notify_user.read_at = timezone.now()
        notify_user.save(update_fields=["is_read", "read_at"])
        return Response(NotifyUserSerializer(notify_user).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = NotifyUser.objects.filter(user=request.user, is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"updated": updated})


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Tag.objects.all()
    lookup_field = "tag_id"
    lookup_url_kwarg = "tagId"

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only admins can create tags")
        serializer.save()


class MetaEnumsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, _request):
        return Response(
            {
                "issueType": [value for value, _ in Issue._meta.get_field("issue_type").choices],
                "issueStatus": [value for value, _ in Issue._meta.get_field("status").choices],
                "priority": [value for value, _ in Issue._meta.get_field("priority").choices],
                "eventType": [value for value, _ in IssueEvent._meta.get_field("event_type").choices],
                "notifyType": [value for value, _ in NotifyType.choices],
            }
        )


def request_user_ids(raw_value):
    if isinstance(raw_value, list):
        return [int(value) for value in raw_value]
    if raw_value in (None, ""):
        return []
    return [int(raw_value)]


def maybe_create_attachment(event: IssueEvent, payload: dict):
    path = payload.get("path")
    if not path:
        return None
    mime_type = payload.get("mimeType", "application/octet-stream")
    size = int(payload.get("size", 0))
    return Attachment.objects.create(update=event, path=path, mime_type=mime_type, size=size)
