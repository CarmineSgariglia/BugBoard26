from django.contrib.auth.models import User
from django.db import models


class Project(models.Model):
    """Project aggregate root.

    `created_by` is audit metadata for the creator. Runtime access is controlled
    by the user's global role plus explicit project memberships.
    """

    project_id = models.AutoField(primary_key=True, db_column="projectId")
    name = models.CharField(max_length=30, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, db_column="createdAt")
    description = models.CharField(max_length=256)
    color = models.CharField(max_length=9, blank=True, default="")
    icon = models.CharField(max_length=256, blank=True, default="")
    members = models.ManyToManyField(User, through="ProjectMembership", related_name="projects")
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        db_column="createdBy",
        related_name="created_projects",
    )

    class Meta:
        db_table = "Project"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class ProjectMembership(models.Model):
    """Project-scoped membership row.

    The user's effective role is still derived from their global groups.
    """

    project_membership_id = models.AutoField(primary_key=True, db_column="projectMembershipId")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, db_column="projectId", related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="project_memberships")

    class Meta:
        db_table = "ProjectMembership"
        constraints = [models.UniqueConstraint(fields=["project", "user"], name="unique_project_user_membership")]
