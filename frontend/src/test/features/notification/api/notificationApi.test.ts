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

  it("lists notifications without parameters", async () => {
    getMock.mockResolvedValue({
      data: { results: [{ notifyUserId: 1 }], nextCursor: null, hasMore: false, hasUnread: true },
    });

    await expect(listNotificationsApi()).resolves.toEqual({
      results: [{ notifyUserId: 1 }],
      nextCursor: null,
      hasMore: false,
      hasUnread: true,
    });
    expect(getMock).toHaveBeenCalledWith("/notifications", { params: {} });
  });

  it("lists notifications with parameters", async () => {
    getMock.mockResolvedValue({
      data: { results: [], nextCursor: null, hasMore: false, hasUnread: false },
    });

    await listNotificationsApi({ limit: 10, before: 100 });
    expect(getMock).toHaveBeenCalledWith("/notifications", {
      params: { limit: 10, before: 100 },
    });
  });

  it("passes AbortSignal when listing notifications", async () => {
    const controller = new AbortController();
    getMock.mockResolvedValue({
      data: { results: [], nextCursor: null, hasMore: false, hasUnread: false },
    });

    await listNotificationsApi({ limit: 10 }, { signal: controller.signal });

    expect(getMock).toHaveBeenCalledWith("/notifications", {
      params: { limit: 10 },
      signal: controller.signal,
    });
  });

  it("reads a notification", async () => {
    postMock.mockResolvedValue({ data: { notifyUserId: 1, isRead: true } });

    await expect(readNotificationApi(1)).resolves.toEqual({ notifyUserId: 1, isRead: true });
    expect(postMock).toHaveBeenCalledWith("/notifications/1/read");
  });

  it("marks all read", async () => {
    postMock.mockResolvedValue({ data: { updated: 2 } });

    await expect(readAllNotificationsApi()).resolves.toEqual({ updated: 2 });
    expect(postMock).toHaveBeenCalledWith("/notifications/read-all");
  });

  it("deletes a notification", async () => {
    deleteMock.mockResolvedValue({ data: undefined });

    await expect(deleteNotificationApi(1)).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith("/notifications/1");
  });

  it("builds stream URL", () => {
    expect(getNotificationsStreamUrl()).toBe("/api/notifications/stream");
  });

  it("propagates API errors", async () => {
    const error = new Error("Network Error");
    getMock.mockRejectedValue(error);

    await expect(listNotificationsApi()).rejects.toThrow(error);
  });
});
