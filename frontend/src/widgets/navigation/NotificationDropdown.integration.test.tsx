import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../test/render";
import { server } from "../../test/mocks/server";
import type { NotificationItem as NotificationApiItem } from "../../shared/api/types/notifications";
import { NotificationDropdown } from "./NotificationDropdown";

describe("NotificationDropdown", () => {
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
});
