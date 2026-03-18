import logging

from .realtime import publish_notification_created
from .serializers import NotifyUserSerializer

logger = logging.getLogger(__name__)


def publish_created_notifications(notify_users_rows) -> None:
    serialized_notifications = NotifyUserSerializer(notify_users_rows, many=True).data
    for notify_user, payload in zip(notify_users_rows, serialized_notifications, strict=False):
        publish_notification_created(notify_user.user_id, payload)
