from django.test import SimpleTestCase

from apps.bugboardapi.modules.users.models import (
    PasswordResetOTP,
    RevokedTokenSession,
    UserProfileImage,
)
from apps.bugboardapi.modules.users.password_reset_models import (
    PasswordResetOTP as PasswordResetOTPConcrete,
)
from apps.bugboardapi.modules.users.profile_models import (
    UserProfileImage as UserProfileImageConcrete,
)
from apps.bugboardapi.modules.users.token_session_models import (
    RevokedTokenSession as RevokedTokenSessionConcrete,
)


class UserModelsExportContractsTests(SimpleTestCase):
    def test_users_models_barrel_re_exports_profile_model(self):
        self.assertIs(UserProfileImage, UserProfileImageConcrete)

    def test_users_models_barrel_re_exports_password_reset_model(self):
        self.assertIs(PasswordResetOTP, PasswordResetOTPConcrete)

    def test_users_models_barrel_re_exports_token_session_model(self):
        self.assertIs(RevokedTokenSession, RevokedTokenSessionConcrete)
