import { screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ManageUsersSection } from "@features/settings/ui/ManageUsersSection";
import { renderWithProviders } from "../../../render";
import { usePaginatedUsers } from "@features/user/hooks/usePaginatedUsers";
import { useAuth } from "@features/auth";

vi.mock("@features/user/hooks/usePaginatedUsers");
vi.mock("@features/auth");

class ResizeObserverMock {
  observe() { }
  unobserve() { }
  disconnect() { }
}

describe("ManageUsersSection", () => {
  const mockUsers = [
    { userId: 1, username: "admin", email: "a@a.com", active: true, isAdmin: true },
    { userId: 2, username: "user1", email: "b@b.com", active: false, isAdmin: false }
  ];

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    vi.mocked(useAuth).mockReturnValue({
      user: { userId: 1, username: "admin", isAdmin: true },
    } as any);

    vi.mocked(usePaginatedUsers).mockReturnValue({
      users: mockUsers,
      totalItems: 2,
      isLoading: false,
      error: "",
      search: "",
      setSearch: vi.fn(),
      statusFilter: "All",
      setStatusFilter: vi.fn(),
      roleFilter: "All",
      setRoleFilter: vi.fn(),
      currentPage: 1,
      setCurrentPage: vi.fn(),
      updateLocalUser: vi.fn(),
    } as any);
  });

  it("renders list table and aggregates properly", () => {
    renderWithProviders(<ManageUsersSection />);

    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("user1")).toBeInTheDocument();
  });
});