from rest_framework import serializers

from ..models import Tag


class TagSerializer(serializers.ModelSerializer):
    tagId = serializers.IntegerField(source="tag_id", read_only=True)

    def validate_name(self, value: str) -> str:
        normalized = Tag.normalize_name(value)
        if not normalized:
            raise serializers.ValidationError("This field may not be blank.")
        return normalized

    class Meta:
        model = Tag
        fields = ["tagId", "name"]
