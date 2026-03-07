from rest_framework import serializers

from ..models import Tag


class TagSerializer(serializers.ModelSerializer):
    tagId = serializers.IntegerField(source="tag_id", read_only=True)

    class Meta:
        model = Tag
        fields = ["tagId", "name"]
