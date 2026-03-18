import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteNotificationApi,
  getNotificationsStreamUrl,
  listNotificationsApi,
  readAllNotificationsApi,
  readNotificationApi,
} from "@features/notification/api";

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
    post: postMock,
    delete: deleteMock,
  },
  apiBaseUrl: "/api",
}));

describe("feature notifications api module", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
  });

  it("lists, reads, marks all read, deletes, and builds the stream URL", async () => {
    getMock.mockResolvedValue({
      data: {
        results: [{ notifyUserId: 1 }],
        nextCursor: null,
        hasMore: false,
        hasUnread: true,
      },
    });
    postMock
      .mockResolvedValueOnce({ data: { notifyUserId: 1, isRead: true } })
      .mockResolvedValueOnce({ data: { updated: 2 } });
    deleteMock.mockResolvedValue({ data: undefined });

    await expect(listNotificationsApi()).resolves.toEqual({
      results: [{ notifyUserId: 1 }],
      nextCursor: null,
      hasMore: false,
      hasUnread: true,
    });
    await expect(readNotificationApi(1)).resolves.toEqual({ notifyUserId: 1, isRead: true });
    await expect(readAllNotificationsApi()).resolves.toEqual({ updated: 2 });
    await expect(deleteNotificationApi(1)).resolves.toBeUndefined();
    expect(getNotificationsStreamUrl()).toBe("/api/notifications/stream");

    expect(getMock).toHaveBeenCalledWith("/notifications", { params: {} });
    expect(postMock).toHaveBeenNthCalledWith(1, "/notifications/1/read");
    expect(postMock).toHaveBeenNthCalledWith(2, "/notifications/read-all");
    expect(deleteMock).toHaveBeenCalledWith("/notifications/1");
  });
});
