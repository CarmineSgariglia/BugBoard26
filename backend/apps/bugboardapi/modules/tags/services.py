from rest_framework import serializers

from .models import Tag


def normalize_tag_name(name: str) -> str:
    return Tag.normalize_name(name)


def find_tag_by_name(name: str) -> Tag | None:
    return Tag.find_by_normalized_name(name)


def get_or_create_tag_by_name(name: str) -> tuple[Tag | None, bool]:
    return Tag.get_or_create_normalized(name)


def validate_existing_tag_ids(tag_ids: list[int] | None) -> None:
    if tag_ids is None:
        return

    existing_tag_ids = set(
        Tag.objects.filter(tag_id__in=tag_ids).values_list("tag_id", flat=True)
    )
    missing_tag_ids = [tag_id for tag_id in tag_ids if tag_id not in existing_tag_ids]
    if missing_tag_ids:
        raise serializers.ValidationError({"tagIds": f"Invalid tag ids: {missing_tag_ids}"})


def resolve_tag_ids(*, tag_ids: list[int], tag_names: list[str]) -> list[int]:
    resolved: list[int] = []
    seen: set[int] = set()

    validate_existing_tag_ids(tag_ids)
    for tag_id in tag_ids:
        if tag_id not in seen:
            seen.add(tag_id)
            resolved.append(tag_id)

    for raw_name in tag_names:
        tag, _ = get_or_create_tag_by_name(raw_name)
        if tag is None:
            continue
        if tag.tag_id not in seen:
            seen.add(tag.tag_id)
            resolved.append(tag.tag_id)

    return resolved
