"""Cross-domain request parsing helpers."""
from __future__ import annotations

from rest_framework.exceptions import ValidationError

MAX_USER_IDS = 100


def parse_int_or_none(raw_value):
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


def request_user_ids(raw_value):
    if isinstance(raw_value, list):
        if len(raw_value) > MAX_USER_IDS:
            raise ValidationError({"userIds": f"Maximum {MAX_USER_IDS} user IDs allowed"})
        try:
            return [int(value) for value in raw_value]
        except (TypeError, ValueError) as exc:
            raise ValidationError({"userIds": "All values must be valid integers"}) from exc
    if raw_value in (None, ""):
        return []
    try:
        return [int(raw_value)]
    except (TypeError, ValueError) as exc:
        raise ValidationError({"userIds": "Value must be a valid integer"}) from exc
