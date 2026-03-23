import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";

import { renderWithProviders } from "../../../render";
import { server } from "../../../mocks/server";
import type { NotificationItem as NotificationApiItem } from "@shared/api/types/notifications";
import { NotificationDropdown } from "@features/notification/ui/NotificationDropdown";

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("NotificationDropdown", () => {
  afterEach(() => {
    navigateMock.mockReset();
    vi.useRealTimers();
  });

  it("renders notifications and marks them as read on click", async () => {
    let readCalled = false;
    let notifications: NotificationApiItem[] = [
      {
        notifyUserId: 101,
        notificationId: 10,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-13T10:00:00Z",
        issueId: 5,
        projectId: 1,
        isRead: false,
        readAt: null,
      },
    ];

    server.use(
      http.get("/api/notifications", () =>
        HttpResponse.json({ results: notifications, nextCursor: null, hasMore: false, hasUnread: true }),
      ),
      http.patch("/api/notifications/:notifyUserId", async () => {
        readCalled = true;
        notifications = notifications.map((notification) =>
          notification.notifyUserId === 101
            ? { ...notification, isRead: true, readAt: "2026-03-13T10:05:00Z" }
            : notification,
        );
        return HttpResponse.json({ notifyUserId: 101, isRead: true });
      }),
    );

    renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    expect(await screen.findByText("Issue updated")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Issue updated"));

    await waitFor(() => {
      expect(readCalled).toBe(true);
      expect(screen.queryByTitle("Mark as read")).not.toBeInTheDocument();
    });
  });

  it("removes a notification after delete", async () => {
    let notifications: NotificationApiItem[] = [
      {
        notifyUserId: 102,
        notificationId: 11,
        type: "PROJECT_ADDED",
        createdAt: "2026-03-13T11:00:00Z",
        issueId: null,
        projectId: 1,
        isRead: true,
        readAt: "2026-03-13T11:05:00Z",
      },
    ];

    server.use(
      http.get("/api/notifications", () =>
        HttpResponse.json({ results: notifications, nextCursor: null, hasMore: false, hasUnread: false }),
      ),
      http.delete("/api/notifications/:notifyUserId", async ({ params }) => {
        notifications = notifications.filter(
          (notification) => notification.notifyUserId !== Number(params.notifyUserId),
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    expect(await screen.findByText("Project added")).toBeInTheDocument();

    await userEvent.click(screen.getByTitle("Delete notification"));

    await waitFor(() => {
      expect(screen.getByText("No notifications")).toBeInTheDocument();
    });
  });

  it("navigates to the issue page by resolving the missing project id", async () => {
    let notifications: NotificationApiItem[] = [
      {
        notifyUserId: 103,
        notificationId: 12,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-13T12:00:00Z",
        issueId: 77,
        projectId: null,
        isRead: false,
        readAt: null,
      },
    ];

    server.use(
      http.get("/api/notifications", () =>
        HttpResponse.json({ results: notifications, nextCursor: null, hasMore: false, hasUnread: true }),
      ),
      http.patch("/api/notifications/:notifyUserId", async () => {
        notifications = notifications.map((notification) =>
          notification.notifyUserId === 103
            ? { ...notification, isRead: true, readAt: "2026-03-13T12:01:00Z" }
            : notification,
        );
        return HttpResponse.json({ notifyUserId: 103, isRead: true });
      }),
      http.get("/api/issues/77", () =>
        HttpResponse.json({
          issueId: 77,
          projectId: 9,
          reporter: {
            userId: 1,
            username: "reporter",
            email: "reporter@test.it",
            role: "DEV",
            firstName: "Test",
            lastName: "Reporter",
          },
          title: "Broken issue",
          description: "Needs fallback navigation",
          type: "BUG",
          status: "OPEN",
          priority: "HIGH",
          createdAt: "2026-03-13T12:00:00Z",
          updatedAt: "2026-03-13T12:00:00Z",
          closedAt: null,
          tags: [],
          assignees: [],
        }),
      ),
    );

    renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    await userEvent.click(await screen.findByText("Issue updated"));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/projects/9/issues/77");
    });
  });

  it("shows an error when issue navigation fallback cannot resolve a project", async () => {
    let notifications: NotificationApiItem[] = [
      {
        notifyUserId: 104,
        notificationId: 13,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-13T13:00:00Z",
        issueId: 88,
        projectId: null,
        isRead: false,
        readAt: null,
      },
    ];

    server.use(
      http.get("/api/notifications", () =>
        HttpResponse.json({ results: notifications, nextCursor: null, hasMore: false, hasUnread: true }),
      ),
      http.patch("/api/notifications/:notifyUserId", async () => {
        notifications = notifications.map((notification) =>
          notification.notifyUserId === 104
            ? { ...notification, isRead: true, readAt: "2026-03-13T13:01:00Z" }
            : notification,
        );
        return HttpResponse.json({ notifyUserId: 104, isRead: true });
      }),
      http.get("/api/issues/88", () => new HttpResponse(null, { status: 404 })),
    );

    renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    await userEvent.click(await screen.findByText("Issue updated"));

    await waitFor(() => {
      expect(screen.getByText("Target non disponibile.")).toBeInTheDocument();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it("updates the open dropdown when the shared notifications cache changes", async () => {
    const initialNotifications: NotificationApiItem[] = [
      {
        notifyUserId: 105,
        notificationId: 14,
        type: "PROJECT_ADDED",
        createdAt: "2026-03-13T14:00:00Z",
        issueId: null,
        projectId: 2,
        isRead: true,
        readAt: "2026-03-13T14:01:00Z",
      },
    ];

    server.use(
      http.get("/api/notifications", () =>
        HttpResponse.json({ results: initialNotifications, nextCursor: null, hasMore: false, hasUnread: false }),
      ),
    );

    const { queryClient } = renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    expect(await screen.findByText("Project added")).toBeInTheDocument();

    act(() => {
      queryClient.setQueryData(["notifications"], {
        pageParams: [null],
        pages: [
          {
            results: [
              {
                notifyUserId: 106,
                notificationId: 15,
                type: "ISSUE_UPDATED",
                createdAt: "2026-03-13T14:05:00Z",
                issueId: 44,
                projectId: 2,
                isRead: false,
                readAt: null,
              },
              ...initialNotifications,
            ],
            nextCursor: null,
            hasMore: false,
            hasUnread: true,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Issue updated")).toBeInTheDocument();
    });
  });

  it("renders notifications inside a dedicated scroll container", async () => {
    const notifications: NotificationApiItem[] = Array.from({ length: 8 }, (_, index) => ({
      notifyUserId: 200 + index,
      notificationId: 300 + index,
      type: "ISSUE_UPDATED",
      createdAt: `2026-03-13T14:${String(index).padStart(2, "0")}:00Z`,
      issueId: 50 + index,
      projectId: 2,
      isRead: index % 2 === 0,
      readAt: index % 2 === 0 ? "2026-03-13T14:30:00Z" : null,
    }));

    server.use(
      http.get("/api/notifications", () =>
        HttpResponse.json({ results: notifications, nextCursor: null, hasMore: false, hasUnread: true }),
      ),
    );

    renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    expect(await screen.findAllByText("Issue updated")).toHaveLength(8);
    expect(screen.getByTestId("notification-scroll-container")).toBeInTheDocument();
  });

  it("loads older notifications when scrolling near the bottom", async () => {
    const firstPage: NotificationApiItem[] = [
      {
        notifyUserId: 301,
        notificationId: 31,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-13T15:00:00Z",
        issueId: 91,
        projectId: 2,
        isRead: false,
        readAt: null,
      },
    ];
    const secondPage: NotificationApiItem[] = [
      {
        notifyUserId: 300,
        notificationId: 30,
        type: "PROJECT_ADDED",
        createdAt: "2026-03-13T14:59:00Z",
        issueId: null,
        projectId: 2,
        isRead: true,
        readAt: "2026-03-13T15:01:00Z",
      },
    ];

    server.use(
      http.get("/api/notifications", ({ request }) => {
        const url = new URL(request.url);
        const before = url.searchParams.get("before");

        if (before === "301") {
          return HttpResponse.json({
            results: secondPage,
            nextCursor: null,
            hasMore: false,
            hasUnread: true,
          });
        }

        return HttpResponse.json({
          results: firstPage,
          nextCursor: 301,
          hasMore: true,
          hasUnread: true,
        });
      }),
    );

    renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    expect(await screen.findByText("Issue updated")).toBeInTheDocument();

    const scrollPanel = screen.getByTestId("notification-scroll-panel");
    Object.defineProperty(scrollPanel, "scrollHeight", { configurable: true, value: 500 });
    Object.defineProperty(scrollPanel, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scrollPanel, "scrollTop", { configurable: true, value: 280, writable: true });

    fireEvent.scroll(scrollPanel);

    await waitFor(() => {
      expect(screen.getByText("Project added")).toBeInTheDocument();
    });
  });
});
