from __future__ import annotations

from django.conf import settings
from rest_framework.exceptions import APIException

from ...common.email_sender import email_sender

PRODUCT_NAME = "BugBoard26"


class UserOnboardingEmailDeliveryFailed(APIException):
    status_code = 503
    default_detail = "User created, but the temporary password email could not be delivered."
    default_code = "user_onboarding_email_failed"


class UserOnboardingEmailService:
    def __init__(self, *, sender=email_sender) -> None:
        self._sender = sender

    def send_credentials_email(
        self,
        *,
        email: str,
        username: str,
        temporary_password: str,
        first_name: str = "",
        last_name: str = "",
    ) -> None:
        recipient_name = " ".join(part.strip() for part in [first_name, last_name] if part.strip())
        self._sender.send(
            email=email,
            plain_subject="BugBoard26 account created",
            plain_message=(
                f"Hello {recipient_name or username},\n\n"
                f"Your BugBoard26 account has been created.\n"
                f"Username: {username}\n"
                f"Temporary password: {temporary_password}\n\n"
                "You can sign in immediately and change the password later."
            ),
            brevo_template_id=getattr(settings, "BREVO_NEW_USER_TEMPLATE_ID", ""),
            brevo_merge_data={
                "username": username,
                "temporary_password": temporary_password,
                "product_name": PRODUCT_NAME,
                "recipient_name": recipient_name,
            },
        )


user_onboarding_email_service = UserOnboardingEmailService()
