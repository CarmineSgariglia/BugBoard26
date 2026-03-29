from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from apps.bugboardapi.modules.issues.activity import (
    ISSUE_EVENT_MESSAGE_MAX_LEN,
    IssueActivityService,
)


def _detail_text(detail) -> str:
    if isinstance(detail, (list, tuple)):
        return str(detail[0])
    return str(detail)


class IssueActivityValidateMessageUniversityTests(SimpleTestCase):
    def setUp(self) -> None:
        self.service = IssueActivityService()

    def test_returns_empty_string_when_message_is_none_and_not_required(self):
        normalized = self.service.validate_message(None)

        self.assertEqual(normalized, "")

    def test_preserves_external_spaces_when_strip_is_disabled(self):
        normalized = self.service.validate_message("  nota con spazi  ", strip=False)

        self.assertEqual(normalized, "  nota con spazi  ")

    def test_strips_external_spaces_when_strip_is_enabled(self):
        normalized = self.service.validate_message("  nota con spazi  ", strip=True)

        self.assertEqual(normalized, "nota con spazi")

    def test_rejects_blank_message_when_required_after_strip(self):
        with self.assertRaises(ValidationError) as ctx:
            self.service.validate_message("   ", required=True, strip=True)

        self.assertEqual(
            _detail_text(ctx.exception.detail["message"]),
            "message is required",
        )

    def test_accepts_message_at_exact_max_length(self):
        message = "a" * ISSUE_EVENT_MESSAGE_MAX_LEN

        normalized = self.service.validate_message(message)

        self.assertEqual(normalized, message)

    def test_rejects_message_longer_than_max_length(self):
        with self.assertRaises(ValidationError) as ctx:
            self.service.validate_message("a" * (ISSUE_EVENT_MESSAGE_MAX_LEN + 1))

        self.assertEqual(
            _detail_text(ctx.exception.detail["message"]),
            "Must be at most 1000 characters",
        )

    def test_converts_non_string_input_before_validation(self):
        normalized = self.service.validate_message(42)

        self.assertEqual(normalized, "42")
