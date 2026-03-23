from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIRequestFactory

from apps.bugboardapi.modules.users.commands import save_profile_image_for_user
from apps.bugboardapi.modules.users.models import UserProfileImage
from apps.bugboardapi.modules.users.mutations import (
    create_user_from_validated_data,
    update_user_from_validated_data,
)
from apps.bugboardapi.roles import ADMIN_GROUP_NAME, DEVELOPER_GROUP_NAME, get_global_role
from apps.bugboardapi.tests.utils import create_user_with_profile


def make_png_bytes(*, size: tuple[int, int], color: str = "blue") -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color=color).save(buffer, format="PNG")
    return buffer.getvalue()


class UserTransactionBoundariesTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.member = create_user_with_profile(
            username="txn_member",
            email="txn_member@example.com",
            password="StrongPass123!",
        )
        self.member.profile.profile_img = f"profile-images/{self.member.id}/existing.png"
        self.member.profile.save(update_fields=["profile_img"])

    @patch(
        "apps.bugboardapi.modules.users.mutations._save_profile_image",
        side_effect=RuntimeError("profile save failed"),
    )
    def test_create_user_rolls_back_when_profile_persistence_fails(self, _mock_profile_save):
        with self.assertRaisesMessage(RuntimeError, "profile save failed"):
            create_user_from_validated_data(
                {
                    "username": "txn_new_user",
                    "email": "txn_new_user@example.com",
                    "password": "StrongPass123!",
                    "group": ADMIN_GROUP_NAME,
                    "profile": {"profile_img": "profile-images/new-user/avatar.png"},
                }
            )

        self.assertFalse(
            UserProfileImage.objects.filter(user__username="txn_new_user").exists()
        )
        self.assertFalse(
            self.member.__class__.objects.filter(username="txn_new_user").exists()
        )

    @patch(
        "apps.bugboardapi.modules.users.mutations.assign_global_role",
        side_effect=RuntimeError("role assignment failed"),
    )
    def test_update_user_rolls_back_fields_and_profile_when_role_assignment_fails(
        self, _mock_assign_role
    ):
        original_username = self.member.username
        original_profile_img = self.member.profile.profile_img

        with self.assertRaisesMessage(RuntimeError, "role assignment failed"):
            update_user_from_validated_data(
                self.member,
                {
                    "username": "txn_member_updated",
                    "group": ADMIN_GROUP_NAME,
                    "profile": {"profile_img": f"profile-images/{self.member.id}/updated.png"},
                },
            )

        self.member.refresh_from_db()
        self.member.profile.refresh_from_db()
        self.assertEqual(self.member.username, original_username)
        self.assertEqual(self.member.profile.profile_img, original_profile_img)
        self.assertFalse(self.member.is_staff)
        self.assertEqual(get_global_role(self.member), DEVELOPER_GROUP_NAME)

    def test_save_profile_image_deletes_new_upload_when_db_update_fails(self):
        request = self.factory.post(
            "/api/users/me/profile-image",
            {
                "profile_img": SimpleUploadedFile(
                    "avatar.png",
                    make_png_bytes(size=(1200, 1200)),
                    content_type="image/png",
                )
            },
            format="multipart",
        )
        request.user = self.member

        with patch(
            "apps.bugboardapi.modules.users.commands.store_upload",
            return_value=SimpleNamespace(
                path=f"profile-images/{self.member.id}/new-avatar.png",
                mime_type="image/png",
                size=8,
            ),
        ), patch(
            "apps.bugboardapi.modules.users.commands.compress_image_upload",
            return_value=SimpleNamespace(
                file=SimpleUploadedFile(
                    "avatar.webp",
                    b"webp",
                    content_type="image/webp",
                ),
                mime_type="image/webp",
                size=4,
                extension=".webp",
            ),
        ), patch.object(
            UserProfileImage,
            "save",
            autospec=True,
            side_effect=RuntimeError("profile update failed"),
        ), patch(
            "apps.bugboardapi.modules.users.commands.default_storage.delete"
        ) as mock_delete:
            with self.assertRaisesMessage(RuntimeError, "profile update failed"):
                save_profile_image_for_user(request=request, user=self.member)

        self.member.refresh_from_db()
        self.member.profile.refresh_from_db()
        self.assertEqual(
            self.member.profile.profile_img,
            f"profile-images/{self.member.id}/existing.png",
        )
        mock_delete.assert_called_once_with(
            f"profile-images/{self.member.id}/new-avatar.png"
        )
