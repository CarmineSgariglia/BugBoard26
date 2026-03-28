export type NotificationType =
  | "PROJECT_ADDED"
  | "PROJECT_ASSIGNED"
  | "PROJECT_REMOVED"
  | "PROJECT_UNASSIGNED"
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

export type NotificationsPage = {
  results: NotificationItem[];
  nextCursor: number | null;
  hasMore: boolean;
  hasUnread: boolean;
};
