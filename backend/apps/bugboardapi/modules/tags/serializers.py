from django.db import IntegrityError
from rest_framework import serializers

from .models import Tag
from .services import find_tag_by_name, normalize_tag_name


class TagSerializer(serializers.ModelSerializer):
    tagId = serializers.IntegerField(source="tag_id", read_only=True)

    def validate_name(self, value: str) -> str:
        normalized = normalize_tag_name(value)
        if not normalized:
            raise serializers.ValidationError("This field may not be blank.")
        existing = find_tag_by_name(normalized)
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
