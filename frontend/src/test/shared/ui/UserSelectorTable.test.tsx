import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserSelectorTable } from "@shared/ui/UserSelectorTable";
import type { AuthUser } from "../../../../src/shared/api/types/auth";

// Mock ScrollComponent
vi.mock("./ScrollComponent", () => ({
  ScrollComponent: ({ children }: any) => <div>{children}</div>,
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as any;

describe("UserSelectorTable", () => {
  const mockUsers: AuthUser[] = [
    { userId: 1, username: "alice", firstName: "Alice", lastName: "Cooper", email: "alice@example.com", isAdmin: false, active: true },
    { userId: 2, username: "bob", firstName: "Bob", lastName: "Marley", email: "bob@example.com", isAdmin: false, active: true },
  ];

  it("renders SearchBar and filters users", async () => {
    const onSearchChange = vi.fn();
    render(<UserSelectorTable users={mockUsers} selectedUserIds={[]} onSearchChange={onSearchChange} />);

    expect(screen.getByPlaceholderText("Search developers...")).toBeInTheDocument();
    expect(screen.getByText("Alice Cooper")).toBeInTheDocument();
    expect(screen.getByText("Bob Marley")).toBeInTheDocument();
  });

  it("displays Add/Remove button toggling selection", async () => {
    const onToggleUser = vi.fn();
    const user = userEvent.setup();

    render(
      <UserSelectorTable 
        users={[mockUsers[0]]} 
        selectedUserIds={[]} 
        onToggleUser={onToggleUser} 
      />
    );

    const addButton = screen.getByRole("button", { name: /Add/i });
    expect(addButton).toBeInTheDocument();

    await user.click(addButton);
    expect(onToggleUser).toHaveBeenCalledWith(1);
  });

  it("handles ViewMode correctly hiding controls", () => {
    render(<UserSelectorTable users={mockUsers} selectedUserIds={[]} isViewMode />);
    
    const badges = screen.queryByText(/selected/i);
    expect(badges).not.toBeInTheDocument();
  });
});
