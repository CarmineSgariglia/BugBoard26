import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@shared/providers";
import type { NotificationItem } from "../../shared/api/types/notifications";
import { NotificationsRealtimeListener } from "./NotificationsRealtimeListener";

const {
  refreshUserMock,
  listNotificationsApiMock,
  getAccessTokenMock,
  refreshApiMock,
} = vi.hoisted(() => ({
  refreshUserMock: vi.fn(),
  listNotificationsApiMock: vi.fn(),
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
  getNotificationsStreamUrl: () => "/api/notifications/stream",
}));

vi.mock("@shared/api/core/client", () => ({
  getAccessToken: getAccessTokenMock,
}));

vi.mock("@shared/api/modules/auth", () => ({
  refreshApi: refreshApiMock,
}));

describe("NotificationsRealtimeListener", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    refreshUserMock.mockReset();
    listNotificationsApiMock.mockReset().mockResolvedValue([]);
    getAccessTokenMock.mockReset().mockReturnValue("test-token");
    refreshApiMock.mockReset().mockResolvedValue("test-token");
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

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <NotificationsRealtimeListener />
        </ToastProvider>
      </QueryClientProvider>,
    );

    await screen.findByText("Issue updated");
    expect(screen.getByText("Issue #42")).toBeInTheDocument();

    await waitFor(() => {
      expect(queryClient.getQueryData<NotificationItem[]>(["notifications"])).toEqual([notification]);
    });
  });
});
