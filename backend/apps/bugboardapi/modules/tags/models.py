from __future__ import annotations

from django.db import IntegrityError, models

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

    @classmethod
    def find_by_normalized_name(cls, name: str) -> Tag | None:
        normalized = cls.normalize_name(name)
        if not normalized:
            return None
        return cls.objects.filter(name__iexact=normalized).order_by("tag_id").first()

    @classmethod
    def get_or_create_normalized(cls, name: str) -> tuple[Tag | None, bool]:
        normalized = cls.normalize_name(name)
        if not normalized:
            return None, False

        existing = cls.find_by_normalized_name(normalized)
        if existing is not None:
            return existing, False

        try:
            return cls.objects.get_or_create(name=normalized)
        except IntegrityError:
            existing = cls.find_by_normalized_name(normalized)
            if existing is not None:
                return existing, False
            raise

    def save(self, *args, **kwargs):
        self.name = self.normalize_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
