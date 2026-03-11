export type NotificationType =
  | "PROJECT_ADDED"
  | "UNASSIGNED_PROJECT"
  | "PROJECT_REMOVED"
  | "ISSUE_ASSIGNED"
  | "ISSUE_ADDED"
  | "ISSUE_CLOSED"
  | "ISSUE_UNASSIGNED"
  | "ISSUE_UPDATED"
  | (string & {}); // fallback for future types

export type NotificationItem = {
  notifyUserId: number;
  notificationId: number;
  type: NotificationType;
  createdAt: string;
  issueId?: number | null;
  projectId?: number | null;
  isRead: boolean;
  readAt?: string | null;
};