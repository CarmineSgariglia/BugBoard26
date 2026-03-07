from django.db import models


class Tag(models.Model):
    tag_id = models.AutoField(primary_key=True, db_column="tagId")
    name = models.CharField(max_length=16, unique=True)

    class Meta:
        db_table = "Tag"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
