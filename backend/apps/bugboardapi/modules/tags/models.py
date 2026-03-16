from django.db import models

# Model to represent a Tag, with a unique name field and ordering by name. The model includes a method to normalize the tag name by stripping whitespace and capitalizing it before saving.
class Tag(models.Model):
    tag_id = models.AutoField(primary_key=True, db_column="tagId")
    name = models.CharField(max_length=16, unique=True)

    class Meta:
        db_table = "Tag"
        ordering = ["name"]

    @staticmethod
    def normalize_name(name: str) -> str:
        return (name or "").strip().capitalize()

    def save(self, *args, **kwargs):
        self.name = self.normalize_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
