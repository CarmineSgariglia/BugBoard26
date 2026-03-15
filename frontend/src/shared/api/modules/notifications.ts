import apiClient, { apiBaseUrl } from "../core/client";
import type { NotificationItem } from "../types/notifications";

export async function listNotificationsApi(): Promise<NotificationItem[]> {
  const { data } = await apiClient.get<NotificationItem[]>("/notifications");
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
