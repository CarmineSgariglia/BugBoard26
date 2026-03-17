from django.contrib.auth.models import User
from django.db import models


class UserProfileImage(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        primary_key=True,
        db_column="userId",
        related_name="profile",
    )
    profile_img = models.CharField(max_length=256, blank=True, default="", db_column="profileImg")

    class Meta:
        db_table = "Users"

    def __str__(self) -> str:
        return self.user.username
