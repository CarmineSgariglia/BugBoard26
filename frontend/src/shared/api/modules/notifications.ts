import apiClient, { apiBaseUrl } from "../core/client";
import type { NotificationItem, NotificationsPage } from "../types/notifications";

export const notificationsQueryKey = ["notifications"] as const;
export const notificationsPollingIntervalMs = 15000;
export const notificationsPageSize = 20;

export async function listNotificationsApi(params?: {
  limit?: number;
  before?: number | null;
}): Promise<NotificationsPage> {
  const { data } = await apiClient.get<NotificationsPage>("/notifications", {
    params: {
      ...(params?.limit != null ? { limit: params.limit } : {}),
      ...(params?.before != null ? { before: params.before } : {}),
    },
  });
  return data;
}

export async function readNotificationApi(notificationId: number): Promise<NotificationItem> {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${notificationId}/read`);
  return data;
}

export async function readAllNotificationsApi(): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>("/notifications/read-all");
  return data;
}

export async function deleteNotificationApi(notificationId: number): Promise<void> {
  await apiClient.delete(`/notifications/${notificationId}`);
}

export function getNotificationsStreamUrl(): string {
  return `${apiBaseUrl}/notifications/stream`;
}
