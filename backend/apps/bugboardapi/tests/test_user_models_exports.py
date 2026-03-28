from django.test import SimpleTestCase

from apps.bugboardapi.modules.users import models as user_models
from apps.bugboardapi.modules.users.models import (
    PasswordResetOTP,
    RevokedTokenSession,
    UserProfileImage,
)


class UserModelsExportContractsTests(SimpleTestCase):
    def test_users_models_module_exports_profile_model(self):
        self.assertIs(UserProfileImage, user_models.UserProfileImage)

    def test_users_models_module_exports_password_reset_model(self):
        self.assertIs(PasswordResetOTP, user_models.PasswordResetOTP)

    def test_users_models_module_exports_token_session_model(self):
        self.assertIs(RevokedTokenSession, user_models.RevokedTokenSession)

    def test_users_models_module_declares_expected_exports(self):
        self.assertEqual(
            user_models.__all__,
            ["PasswordResetOTP", "RevokedTokenSession", "UserProfileImage"],
        )
