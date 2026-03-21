from __future__ import annotations

from django.conf import settings
from django.core.mail import EmailMessage, send_mail
from rest_framework.exceptions import APIException

PRODUCT_NAME = "BugBoard26"


class UserOnboardingEmailDeliveryFailed(APIException):
    status_code = 503
    default_detail = "User created, but the temporary password email could not be delivered."
    default_code = "user_onboarding_email_failed"


def send_new_user_credentials_email(
    *,
    email: str,
    username: str,
    temporary_password: str,
    first_name: str = "",
    last_name: str = "",
) -> None:
    provider = getattr(settings, "EMAIL_PROVIDER", "console").lower()
    recipient_name = " ".join(part.strip() for part in [first_name, last_name] if part.strip())

    if provider == "brevo":
        template_id = getattr(settings, "BREVO_NEW_USER_TEMPLATE_ID", "")
        if not template_id:
            raise RuntimeError(
                "BREVO_NEW_USER_TEMPLATE_ID is required when EMAIL_PROVIDER=brevo"
            )

        message = EmailMessage(
            subject="",
            body="",
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        message.template_id = int(template_id)
        message.merge_global_data = {
            "username": username,
            "temporary_password": temporary_password,
            "product_name": PRODUCT_NAME,
            "recipient_name": recipient_name,
        }
        sender_name = getattr(settings, "BREVO_SENDER_NAME", "").strip()
        if sender_name:
            message.from_email = f"{sender_name} <{settings.DEFAULT_FROM_EMAIL}>"
        message.send(fail_silently=False)
        return

    greeting_name = recipient_name or username
    send_mail(
        subject="BugBoard26 account created",
        message=(
            f"Hello {greeting_name},\n\n"
            f"Your BugBoard26 account has been created.\n"
            f"Username: {username}\n"
            f"Temporary password: {temporary_password}\n\n"
            "You can sign in immediately and change the password later."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
