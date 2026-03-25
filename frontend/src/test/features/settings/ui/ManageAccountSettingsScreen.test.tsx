import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ManageAccountSettingsScreen } from "@features/settings/ui/ManageAccountSettingsScreen";
import { renderWithProviders } from "../../../render";
import { useAuth } from "@features/auth";

vi.mock("@features/auth");

vi.mock("@features/settings/ui/ProfileSettingsSection", () => ({
  ProfileSettingsSection: ({ isAdmin }: { isAdmin: boolean }) => (
    <div>{`Profile section admin:${String(isAdmin)}`}</div>
  ),
}));

vi.mock("@features/settings/ui/AddUsersSection", () => ({
  AddUsersSection: () => <div>Add New User</div>,
}));

vi.mock("@features/settings/ui/ManageUsersSection", () => ({
  ManageUsersSection: ({
    onEditingChange,
    onSelfEditRedirect,
  }: {
    onEditingChange?: (isEditing: boolean) => void;
    onSelfEditRedirect?: () => void;
  }) => (
    <div>
      <span>Manage users body</span>
      <button onClick={() => onEditingChange?.(true)}>Start editing</button>
      <button onClick={() => onEditingChange?.(false)}>Stop editing</button>
      <button onClick={() => onSelfEditRedirect?.()}>Open self profile</button>
    </div>
  ),
}));

describe("ManageAccountSettingsScreen", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userId: 1, username: "boss", isAdmin: true },
    } as any);
  });

  it("renders Sidebar and transitions tabs", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ManageAccountSettingsScreen />);

    // Sidebar options displayed
    expect(screen.getAllByText("Profile Settings")[0]).toBeInTheDocument();
    expect(screen.getByText("Add Users")).toBeInTheDocument();

    // Click on Add Users trigger
    await user.click(screen.getByText("Add Users"));

    // Verify AddUsers section gets rendered instead of Profile
    expect(screen.getByText("Add New User")).toBeInTheDocument();
  });

  it("does not render the sidebar for non-admin users", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userId: 2, username: "dev", isAdmin: false },
    } as any);

    renderWithProviders(<ManageAccountSettingsScreen />);

    expect(screen.getByText("Profile section admin:false")).toBeInTheDocument();
    expect(screen.queryByText("Add Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Users")).not.toBeInTheDocument();
  });

  it("switches to the wide manage-users layout and resets it after editing stops", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<ManageAccountSettingsScreen />);

    await user.click(screen.getByText("Manage Users"));

    expect(screen.getByText("Manage users body")).toBeInTheDocument();

    const wideLayoutContainer = container.querySelector(".pl-0") as HTMLElement;
    expect(wideLayoutContainer).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /start editing/i }));

    expect(container.querySelector(".pl-0")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /stop editing/i }));

    expect(container.querySelector(".pl-0")).toBeInTheDocument();
  });

  it("returns to profile settings when manage-users requests self edit redirect", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ManageAccountSettingsScreen />);

    await user.click(screen.getByText("Manage Users"));
    expect(screen.getByText("Manage users body")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open self profile/i }));

    expect(screen.getByText("Profile section admin:true")).toBeInTheDocument();
    expect(screen.queryByText("Manage users body")).not.toBeInTheDocument();
  });
});
