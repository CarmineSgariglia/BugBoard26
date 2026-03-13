import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";

import { renderWithProviders } from "../../test/render";
import { server } from "../../test/mocks/server";
import type { NotificationItem as NotificationApiItem } from "../../shared/api/types/notifications";
import { NotificationDropdown } from "./NotificationDropdown";

const navigateMock = vi.fn();

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
      http.get("/api/notifications", () => HttpResponse.json(notifications)),
      http.post("/api/notifications/:notifyUserId/read", async () => {
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

    expect(await screen.findByText("ISSUE UPDATED")).toBeInTheDocument();

    await userEvent.click(screen.getByText("ISSUE UPDATED"));

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
      http.get("/api/notifications", () => HttpResponse.json(notifications)),
      http.delete("/api/notifications/:notifyUserId", async ({ params }) => {
        notifications = notifications.filter(
          (notification) => notification.notifyUserId !== Number(params.notifyUserId),
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<NotificationDropdown isOpen onClose={() => {}} />);

    expect(await screen.findByText("PROJECT ADDED")).toBeInTheDocument();

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
      http.get("/api/notifications", () => HttpResponse.json(notifications)),
      http.post("/api/notifications/:notifyUserId/read", async () => {
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

    await userEvent.click(await screen.findByText("ISSUE UPDATED"));

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
      http.get("/api/notifications", () => HttpResponse.json(notifications)),
      http.post("/api/notifications/:notifyUserId/read", async () => {
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

    await userEvent.click(await screen.findByText("ISSUE UPDATED"));

    await waitFor(() => {
      expect(screen.getByText("Target non disponibile.")).toBeInTheDocument();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });
});
