from django.db import IntegrityError
from rest_framework import serializers

from .models import Tag


class TagSerializer(serializers.ModelSerializer):
    tagId = serializers.IntegerField(source="tag_id", read_only=True)

    def validate_name(self, value: str) -> str:
        normalized = Tag.normalize_name(value)
        if not normalized:
            raise serializers.ValidationError("This field may not be blank.")
        existing = Tag.find_by_normalized_name(normalized)
        if existing is not None and (self.instance is None or existing.pk != self.instance.pk):
            raise serializers.ValidationError("This field must be unique.")
        return normalized

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError({"name": "This field must be unique."}) from exc

    class Meta:
        model = Tag
        fields = ["tagId", "name"]
