"""Cross-domain request parsing helpers."""
from __future__ import annotations

from rest_framework.exceptions import ValidationError

MAX_USER_IDS = 100


def parse_int_or_none(raw_value):
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


def parse_int_list(
    raw_value,
    *,
    field_name: str,
    max_items: int | None = None,
) -> list[int]:
    if isinstance(raw_value, list):
        if max_items is not None and len(raw_value) > max_items:
            raise ValidationError({field_name: f"Maximum {max_items} user IDs allowed"})
        try:
            return [int(value) for value in raw_value]
        except (TypeError, ValueError) as exc:
            raise ValidationError({field_name: "All values must be valid integers"}) from exc
    if raw_value in (None, ""):
        return []
    try:
        return [int(raw_value)]
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: "Value must be a valid integer"}) from exc


def parse_csv_ints_query_param(*, raw_value: str | None, field_name: str) -> list[int]:
    normalized = (raw_value or "").strip()
    if not normalized:
        return []
    values = [value.strip() for value in normalized.split(",") if value.strip()]
    try:
        return [int(value) for value in values]
    except ValueError as exc:
        raise ValidationError({field_name: "All values must be valid integers"}) from exc


def request_user_ids(raw_value):
    return parse_int_list(
        raw_value,
        field_name="userIds",
        max_items=MAX_USER_IDS,
    )
