import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManageUsersSection } from "@features/settings/ui/ManageUsersSection";
import { renderWithProviders } from "../../../render";
import { usePaginatedUsers } from "@features/user/hooks/usePaginatedUsers";
import { useAuth } from "@features/auth";
import { setSettingsUserActiveApi } from "@features/settings/api";

vi.mock("@features/user/hooks/usePaginatedUsers");
vi.mock("@features/auth");

vi.mock("@features/settings/api", () => ({
  setSettingsUserActiveApi: vi.fn(),
}));

vi.mock("@shared/ui/SearchBar", () => ({
  SearchBar: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <input
      aria-label="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock("@shared/ui/Select", () => ({
  Select: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ label: string; value: string }>;
  }) => (
    <select
      aria-label={`select-${options[0]?.label ?? "filter"}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@shared/ui/Pagination", () => ({
  Pagination: ({
    currentPage,
    onPageChange,
  }: {
    currentPage: number;
    onPageChange: (page: number) => void;
  }) => (
    <div>
      <span>{`page:${currentPage}`}</span>
      <button onClick={() => onPageChange(currentPage + 1)}>Next page</button>
    </div>
  ),
}));

vi.mock("@shared/ui/UserTable", () => ({
  UserTable: ({
    users,
    renderActions,
  }: {
    users: Array<{ userId: number; username: string }>;
    renderActions?: (user: { userId: number; username: string }) => React.ReactNode;
  }) => (
    <div>
      {users.map((user) => (
        <div key={user.userId}>
          <span>{user.username}</span>
          <div>{renderActions?.(user as any)}</div>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@features/settings/ui/AdminUserEditSection", () => ({
  AdminUserEditSection: ({
    user,
    onClose,
    onUserUpdated,
  }: {
    user: { username: string };
    onClose: () => void;
    onUserUpdated: (user: { userId: number; username: string; email: string; active: boolean }) => void;
  }) => (
    <div>
      <span>{`editing:${user.username}`}</span>
      <button onClick={() => onUserUpdated({ userId: 2, username: "user1-updated", email: "b@b.com", active: false })}>
        Apply update
      </button>
      <button onClick={onClose}>Close editor</button>
    </div>
  ),
}));

vi.mock("@features/settings/ui/ToggleUserStatusModal", () => ({
  ToggleUserStatusModal: ({
    isOpen,
    user,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    user: { username: string } | null;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>{`toggle:${user?.username}`}</span>
        <button onClick={onConfirm}>Confirm toggle</button>
        <button onClick={onClose}>Close toggle</button>
      </div>
    ) : null,
}));

describe("ManageUsersSection", () => {
  const setSearchMock = vi.fn();
  const setStatusFilterMock = vi.fn();
  const setRoleFilterMock = vi.fn();
  const setCurrentPageMock = vi.fn();
  const updateLocalUserMock = vi.fn();

  const mockUsers = [
    { userId: 1, username: "admin", email: "a@a.com", active: true, isAdmin: true, isSuperuser: false },
    { userId: 2, username: "user1", email: "b@b.com", active: false, isAdmin: false, isSuperuser: false },
    { userId: 3, username: "root", email: "root@a.com", active: true, isAdmin: true, isSuperuser: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { userId: 1, username: "admin", isAdmin: true },
    } as any);

    vi.mocked(usePaginatedUsers).mockReturnValue({
      users: mockUsers,
      totalItems: 12,
      isLoading: false,
      error: "",
      search: "",
      setSearch: setSearchMock,
      statusFilter: "All",
      setStatusFilter: setStatusFilterMock,
      roleFilter: "All",
      setRoleFilter: setRoleFilterMock,
      currentPage: 1,
      setCurrentPage: setCurrentPageMock,
      updateLocalUser: updateLocalUserMock,
    } as any);

    vi.mocked(setSettingsUserActiveApi).mockResolvedValue({
      userId: 2,
      username: "user1",
      email: "b@b.com",
      active: true,
    } as any);
  });

  it("renders the list and forwards search, filters and pagination changes", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ManageUsersSection />);

    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("user1")).toBeInTheDocument();
    expect(screen.getByText("root")).toBeInTheDocument();

    await user.type(screen.getByLabelText("search"), "qa");
    await user.selectOptions(screen.getByLabelText("select-All Roles"), "Admin");
    await user.selectOptions(screen.getByLabelText("select-All Users"), "Inactive");
    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(setSearchMock).toHaveBeenCalled();
    expect(setRoleFilterMock).toHaveBeenCalledWith("Admin");
    expect(setStatusFilterMock).toHaveBeenCalledWith("Inactive");
    expect(setCurrentPageMock).toHaveBeenCalledWith(2);
  });

  it("opens the admin edit section and reports editing state changes", async () => {
    const user = userEvent.setup();
    const onEditingChange = vi.fn();

    renderWithProviders(<ManageUsersSection onEditingChange={onEditingChange} />);

    await user.click(screen.getAllByTitle("Edit User")[1]);

    expect(onEditingChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("editing:user1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /apply update/i }));
    expect(updateLocalUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ username: "user1-updated" })
    );

    await user.click(screen.getByRole("button", { name: /close editor/i }));
    expect(onEditingChange).toHaveBeenCalledWith(false);
  });

  it("opens the toggle modal, confirms status changes and blocks self-deactivation", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ManageUsersSection />);

    const actionButtons = screen.getAllByTitle(/Deactivate User|Activate User|You cannot deactivate your own account/i);
    expect(actionButtons[0].hasAttribute("disabled")).toBe(true);

    await user.click(actionButtons[1]);
    expect(screen.getByText("toggle:user1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm toggle/i }));

    await waitFor(() => {
      expect(setSettingsUserActiveApi).toHaveBeenCalledWith(2, true);
      expect(updateLocalUserMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 2, active: true })
      );
    });
  });

  it("disables deactivation for django superusers", () => {
    renderWithProviders(<ManageUsersSection />);

    const rootToggleButton = screen.getByTitle("Django superusers cannot be deactivated");
    expect(rootToggleButton.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("toggle:root")).not.toBeInTheDocument();
  });
});
