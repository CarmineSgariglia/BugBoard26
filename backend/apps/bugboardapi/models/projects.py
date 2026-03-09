from django.contrib.auth.models import User
from django.db import models

# Model to represent a Project, with fields for name, description, color, icon, creation timestamp and a relationship to the user who created the project. The model also includes a unique constraint on the project name and ordering by creation date.
class Project(models.Model):
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

# Intermediate table to manage project membership. Authorization is derived from the user's global role, not stored on the membership row.
class ProjectMembership(models.Model):
    project_membership_id = models.AutoField(primary_key=True, db_column="projectMembershipId")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, db_column="projectId", related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="userId", related_name="project_memberships")

    class Meta:
        db_table = "ProjectMembership"
        constraints = [models.UniqueConstraint(fields=["project", "user"], name="unique_project_user_membership")]
