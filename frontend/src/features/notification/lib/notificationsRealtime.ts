import type { NotificationItem } from "@shared/api/types/notifications";

export function upsertNotifications(
  current: NotificationItem[] = [],
  incoming: NotificationItem | NotificationItem[],
): NotificationItem[] {
  const nextItems = Array.isArray(incoming) ? incoming : [incoming];
  const merged = new Map<number, NotificationItem>();

  for (const item of current) {
    merged.set(item.notifyUserId, item);
  }

  for (const item of nextItems) {
    merged.set(item.notifyUserId, item);
  }

  return [...merged.values()].sort((left, right) => right.notifyUserId - left.notifyUserId);
}

export function getLatestNotificationId(notifications: NotificationItem[] = []): number {
  return notifications.reduce((latest, notification) => {
    return notification.notifyUserId > latest ? notification.notifyUserId : latest;
  }, 0);
}
