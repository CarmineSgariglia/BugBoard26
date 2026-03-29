from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITransactionTestCase

from apps.bugboardapi.modules.users.services import user_service
from apps.bugboardapi.roles import ADMIN_GROUP_NAME
from apps.bugboardapi.tests.utils import create_user_with_profile


class UserOnboardingEmailEndpointTests(APITransactionTestCase):
    def setUp(self):
        self.admin = create_user_with_profile(
            username="onboarding_admin",
            email="onboarding_admin@example.com",
            password="StrongPass123!",
            is_admin=True,
        )

    @override_settings(
        EMAIL_PROVIDER="brevo",
        BREVO_NEW_USER_TEMPLATE_ID="456",
        DEFAULT_FROM_EMAIL="noreply@example.com",
        BREVO_SENDER_NAME="BugBoard26",
    )
    @patch(
        "apps.bugboardapi.common.email_sender.EmailMessage.send",
        autospec=True,
        return_value=1,
    )
    @patch("apps.bugboardapi.common.email_sender.send_mail")
    def test_create_user_without_password_uses_brevo_onboarding_template(
        self,
        mock_send_mail,
        mock_email_send,
    ):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/users",
            {
                "username": "new_user",
                "email": "new_user@example.com",
                "firstName": "New",
                "lastName": "User",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data)
        self.assertFalse(mock_send_mail.called)

        created_user = User.objects.get(username="new_user")
        message = mock_email_send.call_args.args[0]
        temporary_password = message.merge_global_data["temporary_password"]
        self.assertTrue(created_user.check_password(temporary_password))
        self.assertEqual(message.template_id, 456)
        self.assertEqual(message.to, ["new_user@example.com"])
        self.assertEqual(message.merge_global_data["username"], "new_user")
        self.assertEqual(message.merge_global_data["product_name"], "BugBoard26")
        self.assertEqual(message.merge_global_data["recipient_name"], "New User")

    @override_settings(
        EMAIL_PROVIDER="console",
        DEFAULT_FROM_EMAIL="noreply@example.com",
    )
    @patch("apps.bugboardapi.common.email_sender.send_mail")
    def test_create_user_without_password_uses_text_email_for_non_brevo_provider(
        self,
        mock_send_mail,
    ):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/users",
            {
                "username": "console_user",
                "email": "console_user@example.com",
                "firstName": "Console",
                "lastName": "User",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username="console_user")
        kwargs = mock_send_mail.call_args.kwargs
        self.assertEqual(kwargs["recipient_list"], ["console_user@example.com"])
        self.assertIn("Username: console_user", kwargs["message"])
        temporary_password = kwargs["message"].split("Temporary password: ", 1)[1].split("\n", 1)[0]
        self.assertTrue(created_user.check_password(temporary_password))

    @override_settings(
        EMAIL_PROVIDER="brevo",
        BREVO_NEW_USER_TEMPLATE_ID="",
        DEFAULT_FROM_EMAIL="noreply@example.com",
    )
    @patch("apps.bugboardapi.common.email_sender.EmailMessage.send")
    def test_create_user_returns_503_when_brevo_template_is_missing(
        self,
        mock_email_send,
    ):
        self.client.force_authenticate(user=self.admin)
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/users",
            {
                "username": "missing_template_user",
                "email": "missing_template_user@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.data["detail"],
            "User created, but the temporary password email could not be delivered.",
        )
        self.assertTrue(User.objects.filter(username="missing_template_user").exists())
        self.assertFalse(mock_email_send.called)

    @override_settings(
        EMAIL_PROVIDER="console",
        DEFAULT_FROM_EMAIL="noreply@example.com",
    )
    @patch(
        "apps.bugboardapi.common.email_sender.send_mail",
        side_effect=RuntimeError("provider down"),
    )
    def test_create_user_returns_503_and_keeps_user_when_email_delivery_fails(
        self,
        _mock_send_mail,
    ):
        self.client.force_authenticate(user=self.admin)
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/users",
            {
                "username": "delivery_failure_user",
                "email": "delivery_failure_user@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.data["detail"],
            "User created, but the temporary password email could not be delivered.",
        )
        self.assertTrue(User.objects.filter(username="delivery_failure_user").exists())


class UserOnboardingEmailMutationTests(TestCase):
    @patch(
        "apps.bugboardapi.modules.users.services.user_onboarding_email_service.send_credentials_email"
    )
    @patch.object(
        user_service.__class__,
        "_save_profile_image",
        side_effect=RuntimeError("profile save failed"),
    )
    def test_create_user_does_not_send_email_when_persistence_fails(
        self,
        _mock_profile_save,
        mock_send_credentials,
    ):
        with self.assertRaisesMessage(RuntimeError, "profile save failed"):
            user_service.create_from_validated_data(
                {
                    "username": "txn_new_user",
                    "email": "txn_new_user@example.com",
                    "group": ADMIN_GROUP_NAME,
                    "profile": {"profile_img": "profile-images/new-user/avatar.png"},
                }
            )

        self.assertFalse(User.objects.filter(username="txn_new_user").exists())
        mock_send_credentials.assert_not_called()
