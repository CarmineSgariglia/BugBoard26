import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@shared/providers";
import type { NotificationItem } from "../../shared/api/types/notifications";
import { NotificationsRealtimeListener } from "./NotificationsRealtimeListener";

const {
  refreshUserMock,
  listNotificationsApiMock,
  readNotificationApiMock,
  getAccessTokenMock,
  refreshApiMock,
} = vi.hoisted(() => ({
  refreshUserMock: vi.fn(),
  listNotificationsApiMock: vi.fn(),
  readNotificationApiMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  refreshApiMock: vi.fn(),
}));

vi.mock("@shared/providers/AuthContext", () => ({
  useAuth: () => ({
    user: {
      userId: 1,
      username: "stream-user",
      email: "stream@example.com",
      firstName: "Stream",
      lastName: "User",
      isAdmin: false,
      profileImg: null,
      active: true,
    },
    refreshUser: refreshUserMock,
    isLoading: false,
  }),
}));

vi.mock("@shared/api/modules/notifications", () => ({
  listNotificationsApi: listNotificationsApiMock,
  readNotificationApi: readNotificationApiMock,
  getNotificationsStreamUrl: () => "/api/notifications/stream",
  notificationsQueryKey: ["notifications"],
  notificationsPollingIntervalMs: 15000,
}));

vi.mock("@shared/api/core/client", () => ({
  getAccessToken: getAccessTokenMock,
}));

vi.mock("@shared/api/modules/auth", () => ({
  refreshApi: refreshApiMock,
}));

describe("NotificationsRealtimeListener", () => {
  const originalFetch = global.fetch;

  function createStreamResponse(chunks: string[] = []) {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        chunks.forEach((chunk) => {
          controller.enqueue(encoder.encode(chunk));
        });
        controller.close();
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
      },
    });
  }

  function renderListener(queryClient: QueryClient, route = "/settings") {
    render(
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <NotificationsRealtimeListener />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    refreshUserMock.mockReset();
    listNotificationsApiMock.mockReset().mockResolvedValue([]);
    readNotificationApiMock.mockReset().mockResolvedValue({ notifyUserId: 0, isRead: true });
    getAccessTokenMock.mockReset().mockReturnValue("test-token");
    refreshApiMock.mockReset().mockResolvedValue("test-token");
    global.fetch = vi.fn().mockResolvedValue(createStreamResponse());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("updates notifications cache and shows a toast from SSE events", async () => {
    const notification: NotificationItem = {
      notifyUserId: 77,
      notificationId: 13,
      type: "ISSUE_UPDATED",
      createdAt: "2026-03-14T11:15:00Z",
      issueId: 42,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    global.fetch = vi.fn().mockImplementation((_input, init) => {
      const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
      const lastEventId = headers.get("Last-Event-ID");

      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          if (lastEventId !== String(notification.notifyUserId)) {
            controller.enqueue(
              encoder.encode(
                `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
              ),
            );
          }
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
        }),
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient);

    await screen.findByText("Issue updated");
    expect(screen.getByText("Issue #42")).toBeInTheDocument();

    await waitFor(() => {
      expect(queryClient.getQueryData<NotificationItem[]>(["notifications"])).toEqual([notification]);
    });
  });

  it("marks matching issue notifications as read from the initial cache load", async () => {
    let notifications: NotificationItem[] = [
      {
        notifyUserId: 91,
        notificationId: 14,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-14T11:15:00Z",
        issueId: 42,
        projectId: 9,
        isRead: false,
        readAt: null,
      },
    ];

    listNotificationsApiMock.mockImplementation(async () => notifications);
    readNotificationApiMock.mockImplementation(async (notifyUserId: number) => {
      notifications = notifications.map((notification) =>
        notification.notifyUserId === notifyUserId
          ? { ...notification, isRead: true, readAt: "2026-03-14T11:16:00Z" }
          : notification,
      );
      return { notifyUserId, isRead: true };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues/42");

    await waitFor(() => {
      expect(readNotificationApiMock).toHaveBeenCalledWith(91);
      expect(queryClient.getQueryData<NotificationItem[]>(["notifications"])).toEqual([
        expect.objectContaining({
          notifyUserId: 91,
          isRead: true,
        }),
      ]);
    });
  });

  it("marks matching project notifications as read from the project page", async () => {
    let notifications: NotificationItem[] = [
      {
        notifyUserId: 95,
        notificationId: 18,
        type: "PROJECT_ADDED",
        createdAt: "2026-03-14T11:15:00Z",
        issueId: null,
        projectId: 9,
        isRead: false,
        readAt: null,
      },
    ];

    listNotificationsApiMock.mockImplementation(async () => notifications);
    readNotificationApiMock.mockImplementation(async (notifyUserId: number) => {
      notifications = notifications.map((notification) =>
        notification.notifyUserId === notifyUserId
          ? { ...notification, isRead: true, readAt: "2026-03-14T11:16:00Z" }
          : notification,
      );
      return { notifyUserId, isRead: true };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues");

    await waitFor(() => {
      expect(readNotificationApiMock).toHaveBeenCalledWith(95);
      expect(queryClient.getQueryData<NotificationItem[]>(["notifications"])).toEqual([
        expect.objectContaining({
          notifyUserId: 95,
          isRead: true,
        }),
      ]);
    });
  });

  it("does not mark issue notifications as read from the project page", async () => {
    const notifications = [
      {
        notifyUserId: 92,
        notificationId: 15,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-14T11:15:00Z",
        issueId: 42,
        projectId: 9,
        isRead: false,
        readAt: null,
      },
    ] satisfies NotificationItem[];

    listNotificationsApiMock.mockResolvedValue(notifications);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues");

    await waitFor(() => {
      expect(queryClient.getQueryData<NotificationItem[]>(["notifications"])).toEqual(notifications);
      expect(readNotificationApiMock).not.toHaveBeenCalled();
    });
  });

  it("does not re-read notifications that are already read", async () => {
    const notifications = [
      {
        notifyUserId: 93,
        notificationId: 16,
        type: "PROJECT_ADDED",
        createdAt: "2026-03-14T11:15:00Z",
        issueId: null,
        projectId: 9,
        isRead: true,
        readAt: "2026-03-14T11:16:00Z",
      },
    ] satisfies NotificationItem[];

    listNotificationsApiMock.mockResolvedValue(notifications);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues");

    await waitFor(() => {
      expect(queryClient.getQueryData<NotificationItem[]>(["notifications"])).toEqual(notifications);
      expect(readNotificationApiMock).not.toHaveBeenCalled();
    });
  });

  it("auto-reads matching SSE notifications and suppresses the toast on the target page", async () => {
    const notification: NotificationItem = {
      notifyUserId: 94,
      notificationId: 17,
      type: "ISSUE_UPDATED",
      createdAt: "2026-03-14T11:15:00Z",
      issueId: 42,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    let notifications: NotificationItem[] = [];

    listNotificationsApiMock.mockImplementation(async () => notifications);
    readNotificationApiMock.mockImplementation(async (notifyUserId: number) => {
      notifications = notifications.map((currentNotification) =>
        currentNotification.notifyUserId === notifyUserId
          ? { ...currentNotification, isRead: true, readAt: "2026-03-14T11:16:00Z" }
          : currentNotification,
      );
      return { notifyUserId, isRead: true };
    });

    global.fetch = vi.fn().mockResolvedValue(
      createStreamResponse([
        `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
      ]),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues/42");

    await waitFor(() => {
      expect(readNotificationApiMock).toHaveBeenCalledWith(94);
      expect(queryClient.getQueryData<NotificationItem[]>(["notifications"])).toEqual([
        expect.objectContaining({
          notifyUserId: 94,
          isRead: true,
        }),
      ]);
    });

    expect(screen.queryByText("Issue updated")).not.toBeInTheDocument();
  });
});
