import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserTable } from "@shared/ui/UserTable";
import type { AuthUser } from "../../../../src/shared/api/types/auth";

// Mock resolveMediaUrl
vi.mock("@shared/api/core/media", () => ({
  resolveMediaUrl: vi.fn((url) => `${url}-resolved`),
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as any;

describe("UserTable", () => {
  const mockUsers: AuthUser[] = [
    { userId: 1, username: "john", firstName: "John", lastName: "Doe", email: "john@example.com", isAdmin: true, active: true },
    { userId: 2, username: "jane", firstName: "Jane", lastName: "Smith", email: "jane@example.com", isAdmin: false, active: false },
  ];

  it("renders Loading state", () => {
    render(<UserTable users={[]} isLoading={true} />);
    expect(screen.getByText("Loading users...")).toBeInTheDocument();
  });

  it("renders Error state", () => {
    render(<UserTable users={[]} error="Failed fetching" />);
    expect(screen.getByText("Failed fetching")).toBeInTheDocument();
  });

  it("renders users list with correct data mapping", () => {
    render(<UserTable users={mockUsers} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();

    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("triggers custom actions when provided", () => {
    const renderActions = vi.fn((user) => <button>Delete {user.username}</button>);
    
    render(<UserTable users={[mockUsers[0]]} renderActions={renderActions} />);
    
    expect(renderActions).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Delete john")).toBeInTheDocument();
  });
});
