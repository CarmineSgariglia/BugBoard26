export type NotificationItem = {
  notifyUserId: number;
  notificationId: number;
  type: string;
  createdAt: string;
  issueId?: number | null;
  projectId?: number | null;
  isRead: boolean;
  readAt?: string | null;
};
