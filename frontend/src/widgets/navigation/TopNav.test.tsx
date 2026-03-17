import type { InfiniteData } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithProviders } from "../../test/render";
import type { NotificationItem, NotificationsPage } from "@shared/api/types/notifications";
import { TopNav } from "./TopNav";

const { listNotificationsApiMock, refreshUserMock } = vi.hoisted(() => ({
  listNotificationsApiMock: vi.fn(),
  refreshUserMock: vi.fn(),
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: {
      userId: 1,
      username: "dev",
      email: "dev@test.it",
      firstName: "Dev",
      lastName: "User",
      isAdmin: false,
      profileImg: null,
      active: true,
    },
    refreshUser: refreshUserMock,
    isLoading: false,
  }),
}));

vi.mock("@features/notification/api", async () => {
  const actual = await vi.importActual<typeof import("@features/notification/api")>(
    "@features/notification/api",
  );

  return {
    ...actual,
    listNotificationsApi: listNotificationsApiMock,
  };
});

vi.mock("@features/auth/api", () => ({
  logoutApi: vi.fn(),
}));

vi.mock("./DynamicBreadcrumbs", () => ({
  DynamicBreadcrumbs: () => <div>Breadcrumbs</div>,
}));

vi.mock("./ProfileDropdown", () => ({
  ProfileDropdown: () => null,
}));

vi.mock("./AvatarTrigger", () => ({
  AvatarTrigger: () => <button type="button">Avatar</button>,
}));

vi.mock("./LogoutConfirmModal", () => ({
  LogoutConfirmModal: () => null,
}));

describe("TopNav", () => {
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

  beforeEach(() => {
    listNotificationsApiMock.mockReset().mockResolvedValue({
      results: [],
      nextCursor: null,
      hasMore: false,
      hasUnread: false,
    } satisfies NotificationsPage);
  });

  it("does not show the red badge when there are no unread notifications", async () => {
    renderWithProviders(<TopNav />);

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    expect(screen.queryByLabelText("New notifications")).not.toBeInTheDocument();
  });

  it("shows the red badge when there is at least one unread notification", async () => {
    const { queryClient } = renderWithProviders(<TopNav />);

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    queryClient.setQueryData(["notifications"], toInfiniteData([
      {
        notifyUserId: 300,
        notificationId: 60,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-14T18:40:00Z",
        issueId: 91,
        projectId: 7,
        isRead: false,
        readAt: null,
      },
    ], true));

    expect(await screen.findByLabelText("New notifications")).toBeInTheDocument();
  });

  it("keeps the red badge visible when the menu opens and unread notifications remain", async () => {
    const { queryClient } = renderWithProviders(<TopNav />);
    const unreadNotifications: NotificationItem[] = [
      {
        notifyUserId: 301,
        notificationId: 61,
        type: "ISSUE_ASSIGNED",
        createdAt: "2026-03-14T18:41:00Z",
        issueId: 92,
        projectId: 7,
        isRead: false,
        readAt: null,
      },
    ];

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    queryClient.setQueryData(["notifications"], toInfiniteData(unreadNotifications, true));
    listNotificationsApiMock.mockResolvedValue({
      results: unreadNotifications,
      nextCursor: null,
      hasMore: false,
      hasUnread: true,
    } satisfies NotificationsPage);

    expect(await screen.findByLabelText("New notifications")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));

    await waitFor(() => {
      expect(screen.getByText("Issue assigned")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("New notifications")).toBeInTheDocument();
  });

  it("hides the red badge when the cache updates to no unread notifications", async () => {
    const { queryClient } = renderWithProviders(<TopNav />);

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    queryClient.setQueryData(["notifications"], toInfiniteData([
      {
        notifyUserId: 302,
        notificationId: 62,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-14T18:42:00Z",
        issueId: 93,
        projectId: 7,
        isRead: false,
        readAt: null,
      },
    ], true));

    expect(await screen.findByLabelText("New notifications")).toBeInTheDocument();

    queryClient.setQueryData(["notifications"], toInfiniteData([
      {
        notifyUserId: 302,
        notificationId: 62,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-14T18:42:00Z",
        issueId: 93,
        projectId: 7,
        isRead: true,
        readAt: "2026-03-14T18:43:00Z",
      },
    ], false));

    await waitFor(() => {
      expect(screen.queryByLabelText("New notifications")).not.toBeInTheDocument();
    });
  });

  it("hides the red badge when all notifications are deleted", async () => {
    const { queryClient } = renderWithProviders(<TopNav />);

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    queryClient.setQueryData(["notifications"], toInfiniteData([
      {
        notifyUserId: 303,
        notificationId: 63,
        type: "ISSUE_UPDATED",
        createdAt: "2026-03-14T18:44:00Z",
        issueId: 94,
        projectId: 7,
        isRead: false,
        readAt: null,
      },
    ], true));

    expect(await screen.findByLabelText("New notifications")).toBeInTheDocument();

    queryClient.setQueryData(["notifications"], toInfiniteData([], false));

    await waitFor(() => {
      expect(screen.queryByLabelText("New notifications")).not.toBeInTheDocument();
    });
  });
});
