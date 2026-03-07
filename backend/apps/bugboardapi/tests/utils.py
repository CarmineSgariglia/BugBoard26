from django.contrib.auth.models import User

from apps.bugboardapi.models import Project, ProjectMembership, UserProfile


def create_user_with_profile(*, username: str, email: str, password: str, is_admin: bool = False) -> User:
    user = User.objects.create_user(username=username, email=email, password=password, is_staff=is_admin)
    UserProfile.objects.create(user=user, is_admin=is_admin, active=True)
    return user


def create_project_with_members(
    *,
    created_by: User,
    name: str,
    description: str = "Test project",
    color: str = "#14B8A6",
    icon: str = "",
    admin_members: list[User] | None = None,
    developer_members: list[User] | None = None,
) -> Project:
    project = Project.objects.create(
        name=name,
        description=description,
        color=color,
        icon=icon,
        created_by=created_by,
    )
    admin_members = admin_members or []
    developer_members = developer_members or []

    for user in admin_members:
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": ProjectMembership.Role.ADMIN},
        )
    for user in developer_members:
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": ProjectMembership.Role.DEVELOPER},
        )
    return project
