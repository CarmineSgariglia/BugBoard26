import { describe, expect, it, vi } from "vitest";

import type { NotificationItem } from "@shared/api/types/notifications";
import { getLatestNotificationId, upsertNotifications } from "@features/notification/lib/notificationsRealtime";
import { createSseParser } from "@shared/lib/sse";

describe("notificationsRealtime helpers", () => {
  it("parses multiple SSE frames across split chunks", () => {
    const onMessage = vi.fn();
    const parseChunk = createSseParser(onMessage);

    parseChunk("event: ping\ndata: {}\n\nid: 12\nevent: notification.created\ndata: {\"notify");
    parseChunk("UserId\":12,\"notificationId\":6}\n\n");

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(1, {
      event: "ping",
      data: "{}",
    });
    expect(onMessage).toHaveBeenNthCalledWith(2, {
      event: "notification.created",
      id: "12",
      data: "{\"notifyUserId\":12,\"notificationId\":6}",
    });
  });

  it("upserts notifications by notifyUserId and keeps descending order", () => {
    const first: NotificationItem = {
      notifyUserId: 5,
      notificationId: 5,
      type: "ISSUE_UPDATED",
      createdAt: "2026-03-14T10:00:00Z",
      issueId: 10,
      projectId: 3,
      isRead: false,
      readAt: null,
    };
    const second: NotificationItem = {
      notifyUserId: 8,
      notificationId: 8,
      type: "ISSUE_ASSIGNED",
      createdAt: "2026-03-14T11:00:00Z",
      issueId: 11,
      projectId: 3,
      isRead: false,
      readAt: null,
    };
    const updatedFirst: NotificationItem = {
      ...first,
      isRead: true,
    };

    expect(upsertNotifications([first], [second, updatedFirst])).toEqual([second, updatedFirst]);
    expect(getLatestNotificationId([first, second])).toBe(8);
  });
});
