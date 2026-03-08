from django.db import models


class Tag(models.Model):
    tag_id = models.AutoField(primary_key=True, db_column="tagId")
    name = models.CharField(max_length=16, unique=True)

    class Meta:
        db_table = "Tag"
        ordering = ["name"]

    @staticmethod
    def normalize_name(name: str) -> str:
        return (name or "").strip().lower()

    def save(self, *args, **kwargs):
        self.name = self.normalize_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
