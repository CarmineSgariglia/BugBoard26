import apiClient, { apiBaseUrl } from "@shared/api/core/client";
import { withRequestOptions } from "@shared/api/core/config";
import type { RequestOptions } from "@shared/api";
import type { NotificationItem, NotificationsPage } from "@shared/api/types/notifications";

export const notificationsQueryKey = ["notifications"] as const;
export const notificationsPageSize = 20;

export async function listNotificationsApi(params?: {
  limit?: number;
  before?: number | null;
}, options?: RequestOptions): Promise<NotificationsPage> {
  const { data } = await apiClient.get<NotificationsPage>("/notifications", {
    ...withRequestOptions(
      {
        params: {
          ...(params?.limit != null ? { limit: params.limit } : {}),
          ...(params?.before != null ? { before: params.before } : {}),
        },
      },
      options,
    ),
  });
  return data;
}

export async function readNotificationApi(notificationId: number): Promise<NotificationItem> {
  const { data } = await apiClient.patch<NotificationItem>(`/notifications/${notificationId}`, {
    isRead: true,
  });
  return data;
}

export async function deleteNotificationApi(notificationId: number): Promise<void> {
  await apiClient.delete(`/notifications/${notificationId}`);
}

export function getNotificationsStreamUrl(): string {
  return `${apiBaseUrl}/notifications/stream`;
}
