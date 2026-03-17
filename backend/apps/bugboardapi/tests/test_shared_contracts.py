from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.bugboardapi.common.media import build_media_url
from apps.bugboardapi.common.parsing import (
    MAX_USER_IDS,
    parse_csv_ints_query_param,
    parse_int_list,
    parse_int_or_none,
    request_user_ids,
)
from apps.bugboardapi.roles import (
    ADMIN_GROUP_NAME,
    DEVELOPER_GROUP_NAME,
    assign_global_role,
    ensure_global_role_groups,
    get_global_role,
    has_global_role,
    is_admin_user,
)
from apps.bugboardapi.security.uploads import store_upload, validate_profile_image


class RoleContractsTests(TestCase):
    def test_ensure_global_role_groups_returns_expected_mapping(self):
        groups = ensure_global_role_groups()

        self.assertEqual(set(groups), {ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME})
        self.assertEqual(groups[ADMIN_GROUP_NAME].name, ADMIN_GROUP_NAME)
        self.assertEqual(groups[DEVELOPER_GROUP_NAME].name, DEVELOPER_GROUP_NAME)

    def test_get_global_role_prefers_superuser_over_group_membership(self):
        user = User.objects.create_user(
            username="roles_superuser",
            email="roles_superuser@example.com",
            password="StrongPass123!",
        )
        assign_global_role(user, DEVELOPER_GROUP_NAME)
        user.is_superuser = True
        user.save(update_fields=["is_superuser"])

        self.assertEqual(get_global_role(user), ADMIN_GROUP_NAME)

    def test_assign_global_role_replaces_group_and_updates_staff_flag(self):
        user = User.objects.create_user(
            username="roles_member",
            email="roles_member@example.com",
            password="StrongPass123!",
        )

        assign_global_role(user, ADMIN_GROUP_NAME)
        user.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertEqual(list(user.groups.values_list("name", flat=True)), [ADMIN_GROUP_NAME])

        assign_global_role(user, DEVELOPER_GROUP_NAME)
        user.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertEqual(list(user.groups.values_list("name", flat=True)), [DEVELOPER_GROUP_NAME])

    def test_has_global_role_treats_admin_as_having_any_requested_role(self):
        user = User.objects.create_user(
            username="roles_admin",
            email="roles_admin@example.com",
            password="StrongPass123!",
        )
        assign_global_role(user, ADMIN_GROUP_NAME)

        self.assertTrue(has_global_role(user, DEVELOPER_GROUP_NAME))
        self.assertTrue(is_admin_user(user))


class ParsingContractsTests(SimpleTestCase):
    def test_parse_int_or_none_returns_none_for_invalid_values(self):
        self.assertEqual(parse_int_or_none("42"), 42)
        self.assertIsNone(parse_int_or_none("not-an-int"))
        self.assertIsNone(parse_int_or_none(None))

    def test_request_user_ids_normalizes_empty_and_scalar_values(self):
        self.assertEqual(request_user_ids(None), [])
        self.assertEqual(request_user_ids(""), [])
        self.assertEqual(request_user_ids("7"), [7])

    def test_request_user_ids_rejects_invalid_scalar(self):
        with self.assertRaises(ValidationError) as exc:
            request_user_ids("abc")

        self.assertEqual(str(exc.exception.detail["userIds"]), "Value must be a valid integer")

    def test_request_user_ids_rejects_too_many_values(self):
        with self.assertRaises(ValidationError) as exc:
            request_user_ids(list(range(MAX_USER_IDS + 1)))

        self.assertEqual(
            str(exc.exception.detail["userIds"]),
            f"Maximum {MAX_USER_IDS} user IDs allowed",
        )

    def test_parse_int_list_accepts_custom_field_names(self):
        self.assertEqual(
            parse_int_list(["1", "2"], field_name="projectIds", max_items=5),
            [1, 2],
        )

    def test_parse_csv_ints_query_param_preserves_users_query_contract(self):
        self.assertEqual(
            parse_csv_ints_query_param(raw_value="1, 2,3", field_name="userIds"),
            [1, 2, 3],
        )

        with self.assertRaises(ValidationError) as exc:
            parse_csv_ints_query_param(raw_value="1,abc", field_name="excludeUserIds")

        self.assertEqual(
            str(exc.exception.detail["excludeUserIds"]),
            "All values must be valid integers",
        )


class MediaUrlContractsTests(SimpleTestCase):
    def test_build_media_url_preserves_absolute_and_media_prefixed_values(self):
        self.assertEqual(build_media_url(None, ""), "")
        self.assertEqual(
            build_media_url(None, "https://cdn.example.com/avatar.png"),
            "https://cdn.example.com/avatar.png",
        )
        self.assertEqual(build_media_url(None, "/media/avatar.png"), "/media/avatar.png")

    @override_settings(MEDIA_URL="/files")
    def test_build_media_url_normalizes_relative_media_paths(self):
        self.assertEqual(
            build_media_url(None, "media/profile-images/avatar.png"),
            "/files/profile-images/avatar.png",
        )
        self.assertEqual(
            build_media_url(None, "/profile-images/avatar.png"),
            "/files/profile-images/avatar.png",
        )

    @override_settings(MEDIA_URL="https://cdn.example.com/media")
    def test_build_media_url_uses_media_url_as_absolute_base(self):
        self.assertEqual(
            build_media_url(None, "issue-attachments/file.pdf"),
            "https://cdn.example.com/media/issue-attachments/file.pdf",
        )


class UploadStorageContractsTests(SimpleTestCase):
    @patch("apps.bugboardapi.security.uploads.default_storage.save", return_value="profile-images/1/saved.jpg")
    def test_store_upload_returns_saved_path_and_file_metadata(self, mocked_save):
        uploaded = SimpleUploadedFile("avatar.jpg", b"jpeg-content", content_type="image/jpeg")

        stored = store_upload(
            uploaded_file=uploaded,
            storage_dir="profile-images/1",
            filename_suffix=".jpg",
        )

        saved_path = mocked_save.call_args.args[0]
        self.assertTrue(saved_path.startswith("profile-images/1/"))
        self.assertTrue(saved_path.endswith(".jpg"))
        self.assertEqual(stored.path, "profile-images/1/saved.jpg")
        self.assertEqual(stored.mime_type, "image/jpeg")
        self.assertEqual(stored.size, len(b"jpeg-content"))

    def test_validate_profile_image_accepts_jpeg_extension_alias(self):
        image = SimpleUploadedFile(
            "avatar.jpeg",
            b"\xff\xd8\xffvalid-jpeg",
            content_type="image/jpeg",
        )

        extension, size = validate_profile_image(image)

        self.assertEqual(extension, "jpg")
        self.assertEqual(size, len(image.read()))
