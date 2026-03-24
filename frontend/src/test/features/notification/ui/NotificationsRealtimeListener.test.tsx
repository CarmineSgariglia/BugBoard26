import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@shared/providers";
import type { NotificationItem, NotificationsPage } from "@shared/api/types/notifications";
import type { Issue } from "@shared/api/types/issues";
import type { Project } from "@shared/api/types/projects";
import { NotificationsRealtimeListener } from "@features/notification/ui/NotificationsRealtimeListener";

const {
  refreshUserMock,
  listNotificationsApiMock,
  readNotificationApiMock,
  deleteNotificationApiMock,
  getProjectApiMock,
  getIssueApiMock,
  getAccessTokenMock,
  refreshApiMock,
} = vi.hoisted(() => ({
  refreshUserMock: vi.fn(),
  listNotificationsApiMock: vi.fn(),
  readNotificationApiMock: vi.fn(),
  deleteNotificationApiMock: vi.fn(),
  getProjectApiMock: vi.fn(),
  getIssueApiMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  refreshApiMock: vi.fn(),
}));

vi.mock("@features/auth", () => ({
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

vi.mock("@features/notification/api", () => ({
  listNotificationsApi: listNotificationsApiMock,
  readNotificationApi: readNotificationApiMock,
  deleteNotificationApi: deleteNotificationApiMock,
  getNotificationsStreamUrl: () => "/api/notifications/stream",
  notificationsQueryKey: ["notifications"],
  notificationsPageSize: 20,
}));

vi.mock("@features/project/api", () => ({
  getProjectApi: getProjectApiMock,
}));

vi.mock("@features/issue/api", () => ({
  getIssueApi: getIssueApiMock,
}));

vi.mock("@shared/api/core/client", () => ({
  getAccessToken: getAccessTokenMock,
}));

vi.mock("@features/auth/api", () => ({
  refreshApi: refreshApiMock,
}));

describe("NotificationsRealtimeListener", () => {
  const originalFetch = global.fetch;

  function toInfiniteData(
    notifications: NotificationItem[],
    hasUnread = notifications.some((notification) => !notification.isRead),
  ): InfiniteData<NotificationsPage> {
    return {
      pageParams: [null],
      pages: [
        {
          results: notifications,
          nextCursor: null,
          hasMore: false,
          hasUnread,
        },
      ],
    };
  }

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
    function PathnameProbe() {
      const location = useLocation();
      return <div data-testid="pathname-probe">{location.pathname}</div>;
    }

    return render(
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <NotificationsRealtimeListener />
            <PathnameProbe />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    refreshUserMock.mockReset();
    listNotificationsApiMock.mockReset().mockResolvedValue({
      results: [],
      nextCursor: null,
      hasMore: false,
      hasUnread: false,
    } satisfies NotificationsPage);
    readNotificationApiMock.mockReset().mockResolvedValue({ notifyUserId: 0, isRead: true });
    deleteNotificationApiMock.mockReset().mockResolvedValue(undefined);
    getProjectApiMock.mockReset().mockResolvedValue({
      projectId: 9,
      name: "Realtime Project",
      description: "Loaded from notification",
      color: "#123456",
      icon: "folder",
      createdAt: "2026-03-19T10:19:00Z",
      createdBy: 1,
      authorProfileImg: null,
    });
    getIssueApiMock.mockReset().mockResolvedValue({
      issueId: 101,
      projectId: 9,
      reporterId: 1,
      reporter: {
        userId: 1,
        username: "stream-user",
        email: "stream@example.com",
        firstName: "Stream",
        lastName: "User",
        isAdmin: false,
        profileImg: null,
        active: true,
      },
      title: "Realtime Issue",
      description: "Loaded from notification",
      type: "Bug",
      status: "Open",
      priority: "High",
      createdAt: "2026-03-19T10:25:00Z",
      updatedAt: "2026-03-19T10:25:00Z",
      closedAt: null,
      tags: [],
      assignees: [],
    } satisfies Issue);
    getAccessTokenMock.mockReset().mockReturnValue("test-token");
    refreshApiMock.mockReset().mockResolvedValue("test-token");
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve(createStreamResponse()));
    window.sessionStorage.clear();
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
      expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
        toInfiniteData([notification], true),
      );
    });
  });

  it("hydrates only the added project into the home projects cache on PROJECT_ADDED", async () => {
    const notification: NotificationItem = {
      notifyUserId: 78,
      notificationId: 14,
      type: "PROJECT_ADDED",
      createdAt: "2026-03-19T10:20:00Z",
      issueId: null,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    let hasSentEvent = false;
    global.fetch = vi.fn().mockImplementation(() => {
      if (hasSentEvent) {
        return Promise.resolve(createStreamResponse());
      }

      hasSentEvent = true;
      return Promise.resolve(
        createStreamResponse([
          `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
        ]),
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    queryClient.setQueryData(["projects"], [
      {
        projectId: 2,
        name: "Existing Project",
        description: "Already in cache",
        color: "#654321",
        icon: "folder",
        createdAt: "2026-03-18T10:00:00Z",
        createdBy: 1,
        authorProfileImg: null,
      },
    ]);

    renderListener(queryClient, "/projects");

    await waitFor(() => {
      expect(getProjectApiMock).toHaveBeenCalledWith(9, expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(queryClient.getQueryData<Project[]>(["projects"])).toEqual([
        expect.objectContaining({ projectId: 9, name: "Realtime Project" }),
        expect.objectContaining({ projectId: 2, name: "Existing Project" }),
      ]);
    });
  });

  it("hydrates only the added issue into the cached project issues on ISSUE_ADDED", async () => {
    const notification: NotificationItem = {
      notifyUserId: 79,
      notificationId: 15,
      type: "ISSUE_ADDED",
      createdAt: "2026-03-19T10:26:00Z",
      issueId: 101,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    let hasSentEvent = false;
    global.fetch = vi.fn().mockImplementation(() => {
      if (hasSentEvent) {
        return Promise.resolve(createStreamResponse());
      }

      hasSentEvent = true;
      return Promise.resolve(
        createStreamResponse([
          `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
        ]),
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    queryClient.setQueryData(["project", "9", "issues"], [
      {
        issueId: 88,
        projectId: 9,
        title: "Existing Issue",
      },
    ]);

    renderListener(queryClient, "/projects/9/issues");

    await waitFor(() => {
      expect(getIssueApiMock).toHaveBeenCalledWith(101, expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(queryClient.getQueryData<Issue[]>(["project", "9", "issues"])).toEqual([
        expect.objectContaining({ issueId: 88, title: "Existing Issue" }),
        expect.objectContaining({ issueId: 101, title: "Realtime Issue" }),
      ]);
    });

    expect(queryClient.getQueryData<Issue>(["issue", 101])).toEqual(
      expect.objectContaining({ issueId: 101, title: "Realtime Issue" }),
    );
  });

  it("aborts in-flight project hydration on unmount", async () => {
    const notification: NotificationItem = {
      notifyUserId: 140,
      notificationId: 25,
      type: "PROJECT_ADDED",
      createdAt: "2026-03-19T10:20:00Z",
      issueId: null,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    let hasSentEvent = false;
    global.fetch = vi.fn().mockImplementation(() => {
      if (hasSentEvent) {
        return Promise.resolve(createStreamResponse());
      }

      hasSentEvent = true;
      return Promise.resolve(
        createStreamResponse([
          `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
        ]),
      );
    });

    let aborted = false;
    getProjectApiMock.mockImplementation(
      (_projectId: number, options?: { signal?: AbortSignal }) =>
        new Promise<Project>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject({ name: "AbortError" });
          });
        }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const view = renderListener(queryClient, "/projects");

    await waitFor(() => {
      expect(getProjectApiMock).toHaveBeenCalled();
    });

    view.unmount();

    await waitFor(() => {
      expect(aborted).toBe(true);
    });
  });

  it("does not show a toast for already loaded read notifications during stream bootstrap", async () => {
    const existingNotification: NotificationItem = {
      notifyUserId: 120,
      notificationId: 21,
      type: "ISSUE_UPDATED",
      createdAt: "2026-03-14T11:15:00Z",
      issueId: 42,
      projectId: 9,
      isRead: true,
      readAt: "2026-03-14T11:16:00Z",
    };

    listNotificationsApiMock.mockResolvedValue({
      results: [existingNotification],
      nextCursor: null,
      hasMore: false,
      hasUnread: false,
    } satisfies NotificationsPage);

    global.fetch = vi.fn().mockImplementation((_input, init) => {
      const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
      expect(headers.get("Last-Event-ID")).toBe(String(existingNotification.notifyUserId));
      return Promise.resolve(createStreamResponse());
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
        toInfiniteData([existingNotification], false),
      );
    });

    expect(screen.queryByText("Issue updated")).not.toBeInTheDocument();
  });

  it("does not show a toast for already loaded unread notifications during stream bootstrap", async () => {
    const existingNotification: NotificationItem = {
      notifyUserId: 121,
      notificationId: 22,
      type: "ISSUE_UPDATED",
      createdAt: "2026-03-14T11:15:00Z",
      issueId: 43,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    listNotificationsApiMock.mockResolvedValue({
      results: [existingNotification],
      nextCursor: null,
      hasMore: false,
      hasUnread: true,
    } satisfies NotificationsPage);

    global.fetch = vi.fn().mockImplementation((_input, init) => {
      const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
      expect(headers.get("Last-Event-ID")).toBe(String(existingNotification.notifyUserId));
      return Promise.resolve(createStreamResponse());
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
        toInfiniteData([existingNotification], true),
      );
    });

    expect(screen.queryByText("Issue updated")).not.toBeInTheDocument();
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

    listNotificationsApiMock.mockImplementation(
      async () =>
        ({
          results: notifications,
          nextCursor: null,
          hasMore: false,
          hasUnread: true,
        }) satisfies NotificationsPage,
    );
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
      expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
        toInfiniteData([
          expect.objectContaining({
            notifyUserId: 91,
            isRead: true,
          }) as unknown as NotificationItem,
        ]),
      );
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

    listNotificationsApiMock.mockImplementation(
      async () =>
        ({
          results: notifications,
          nextCursor: null,
          hasMore: false,
          hasUnread: true,
        }) satisfies NotificationsPage,
    );
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
      expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
        toInfiniteData([
          expect.objectContaining({
            notifyUserId: 95,
            isRead: true,
          }) as unknown as NotificationItem,
        ]),
      );
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

    listNotificationsApiMock.mockResolvedValue({
      results: notifications,
      nextCursor: null,
      hasMore: false,
      hasUnread: true,
    } satisfies NotificationsPage);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues");

    await waitFor(() => {
      expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
        toInfiniteData(notifications),
      );
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

    listNotificationsApiMock.mockResolvedValue({
      results: notifications,
      nextCursor: null,
      hasMore: false,
      hasUnread: false,
    } satisfies NotificationsPage);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues");

    await waitFor(() => {
      expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
        toInfiniteData(notifications),
      );
      expect(readNotificationApiMock).not.toHaveBeenCalled();
    });
  });

  it("deletes matching SSE notifications instead of showing them on the target issue page", async () => {
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

    listNotificationsApiMock.mockImplementation(
      async () =>
        ({
          results: notifications,
          nextCursor: null,
          hasMore: false,
          hasUnread: false,
        }) satisfies NotificationsPage,
    );
    deleteNotificationApiMock.mockImplementation(async (notifyUserId: number) => {
      notifications = notifications.map((currentNotification) =>
        currentNotification.notifyUserId === notifyUserId
          ? currentNotification
          : currentNotification,
      );
      notifications = notifications.filter((currentNotification) => currentNotification.notifyUserId !== notifyUserId);
    });

    global.fetch = vi.fn().mockResolvedValue(
      createStreamResponse(),
    );
    global.fetch = vi.fn().mockImplementation((_input, init) => {
      const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
      const lastEventId = headers.get("Last-Event-ID");

      if (lastEventId !== String(notification.notifyUserId)) {
        notifications = [notification];
        return Promise.resolve(
          createStreamResponse([
            `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
          ]),
        );
      }

      return Promise.resolve(createStreamResponse());
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    renderListener(queryClient, "/projects/9/issues/42");

    await waitFor(() => {
      expect(deleteNotificationApiMock).toHaveBeenCalledWith(94);
    });

    expect(queryClient.getQueryData<InfiniteData<NotificationsPage>>(["notifications"])).toEqual(
      toInfiniteData([], false),
    );
    expect(screen.queryByText("Issue updated")).not.toBeInTheDocument();
    expect(readNotificationApiMock).not.toHaveBeenCalled();
  });

  it("removes project access immediately and redirects to home when a project unassignment arrives", async () => {
    const notification: NotificationItem = {
      notifyUserId: 202,
      notificationId: 31,
      type: "PROJECT_UNASSIGNED",
      createdAt: "2026-03-19T10:16:00Z",
      issueId: null,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    let hasSentEvent = false;
    global.fetch = vi.fn().mockImplementation(() => {
      if (hasSentEvent) {
        return Promise.resolve(createStreamResponse());
      }

      hasSentEvent = true;
      return Promise.resolve(
        createStreamResponse([
          `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
        ]),
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    queryClient.setQueryData(["projects"], [
      { projectId: 9, name: "Locked Project" },
      { projectId: 14, name: "Open Project" },
    ]);
    queryClient.setQueryData(["project", 9], { projectId: 9, name: "Locked Project" });
    queryClient.setQueryData(["project", "9", "issues"], [{ issueId: 1 }]);

    renderListener(queryClient, "/projects/9/issues");

    await waitFor(() => {
      expect(screen.getByTestId("pathname-probe")).toHaveTextContent("/projects");
      expect(queryClient.getQueryData(["projects"])).toEqual([
        { projectId: 14, name: "Open Project" },
      ]);
    });

    expect(queryClient.getQueryData(["project", 9])).toBeUndefined();
    expect(screen.getByText("Project unassigned")).toBeInTheDocument();
  });

  it("redirects to home and removes project cache when a project removed event arrives", async () => {
    const notification: NotificationItem = {
      notifyUserId: 203,
      notificationId: 32,
      type: "PROJECT_REMOVED",
      createdAt: "2026-03-19T10:17:00Z",
      issueId: null,
      projectId: 9,
      isRead: false,
      readAt: null,
    };

    let hasSentEvent = false;
    global.fetch = vi.fn().mockImplementation(() => {
      if (hasSentEvent) {
        return Promise.resolve(createStreamResponse());
      }

      hasSentEvent = true;
      return Promise.resolve(
        createStreamResponse([
          `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
        ]),
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    queryClient.setQueryData(["projects"], [
      { projectId: 9, name: "Removed Project" },
      { projectId: 14, name: "Open Project" },
    ]);
    queryClient.setQueryData(["project", "9"], { projectId: 9, name: "Removed Project" });
    queryClient.setQueryData(["project", "9", "members"], [{ userId: 1 }]);

    renderListener(queryClient, "/projects/9/issues/42");

    await waitFor(() => {
      expect(screen.getByTestId("pathname-probe")).toHaveTextContent("/projects");
      expect(queryClient.getQueryData(["projects"])).toEqual([
        { projectId: 14, name: "Open Project" },
      ]);
    });

    expect(queryClient.getQueryData(["project", "9"])).toBeUndefined();
    expect(screen.getByText("Project removed")).toBeInTheDocument();
  });

  it("invalidates the current project queries when project removed arrives without projectId", async () => {
    const notification: NotificationItem = {
      notifyUserId: 204,
      notificationId: 33,
      type: "PROJECT_REMOVED",
      createdAt: "2026-03-19T10:18:00Z",
      issueId: null,
      projectId: null,
      isRead: false,
      readAt: null,
    };

    let hasSentEvent = false;
    global.fetch = vi.fn().mockImplementation(() => {
      if (hasSentEvent) {
        return Promise.resolve(createStreamResponse());
      }

      hasSentEvent = true;
      return Promise.resolve(
        createStreamResponse([
          `id: ${notification.notifyUserId}\nevent: notification.created\ndata: ${JSON.stringify(notification)}\n\n`,
        ]),
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderListener(queryClient, "/projects/9/issues/42");

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalled();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });
    expect(screen.getByTestId("pathname-probe")).toHaveTextContent("/projects/9/issues/42");
  });
});
