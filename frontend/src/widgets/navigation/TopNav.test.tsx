import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithProviders } from "../../test/render";
import type { NotificationItem } from "../../shared/api/types/notifications";
import { TopNav } from "./TopNav";

const { listNotificationsApiMock, refreshUserMock } = vi.hoisted(() => ({
  listNotificationsApiMock: vi.fn(),
  refreshUserMock: vi.fn(),
}));

vi.mock("@shared/providers/AuthContext", () => ({
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

vi.mock("../../shared/api/modules/notifications", async () => {
  const actual = await vi.importActual<typeof import("../../shared/api/modules/notifications")>(
    "../../shared/api/modules/notifications",
  );

  return {
    ...actual,
    listNotificationsApi: listNotificationsApiMock,
  };
});

vi.mock("../../shared/api/modules/auth", () => ({
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
  beforeEach(() => {
    listNotificationsApiMock.mockReset().mockResolvedValue([]);
  });

  it("shows a red badge when a new notification arrives while the menu is closed", async () => {
    const { queryClient } = renderWithProviders(<TopNav />);

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    expect(screen.queryByLabelText("New notifications")).not.toBeInTheDocument();

    queryClient.setQueryData<NotificationItem[]>(["notifications"], [
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
    ]);

    expect(await screen.findByLabelText("New notifications")).toBeInTheDocument();
  });

  it("clears the red badge when the notifications menu is opened", async () => {
    const { queryClient } = renderWithProviders(<TopNav />);

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    queryClient.setQueryData<NotificationItem[]>(["notifications"], [
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
    ]);

    expect(await screen.findByLabelText("New notifications")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("New notifications")).not.toBeInTheDocument();
    });
  });

  it("does not show the red badge when a new notification arrives while the menu is open", async () => {
    const { queryClient } = renderWithProviders(<TopNav />);

    await waitFor(() => {
      expect(listNotificationsApiMock).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));

    queryClient.setQueryData<NotificationItem[]>(["notifications"], [
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
    ]);

    await waitFor(() => {
      expect(screen.getByText("Issue updated")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("New notifications")).not.toBeInTheDocument();
  });
});
