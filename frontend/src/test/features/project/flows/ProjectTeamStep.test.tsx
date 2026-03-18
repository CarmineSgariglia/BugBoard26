import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectTeamStep } from "@features/project/flows/ProjectTeamStep";
import { renderWithProviders } from "../../../render";

// Mock usePaginatedUsers to avoid API calls
const { usePaginatedUsersMock } = vi.hoisted(() => ({
  usePaginatedUsersMock: vi.fn(),
}));
vi.mock("@features/user/hooks/usePaginatedUsers", () => ({
  usePaginatedUsers: usePaginatedUsersMock,
}));

// Mock heavy UI components
vi.mock("@shared/ui/UserSelectorTable", () => ({
  UserSelectorTable: ({
    users,
    isLoading,
    error,
    isViewMode,
  }: {
    users: Array<{ userId: number; username: string }>;
    isLoading?: boolean;
    error?: string;
    isViewMode?: boolean;
  }) => (
    <div data-testid="user-selector-table">
      {isLoading && <span>Loading...</span>}
      {error && <span data-testid="table-error">{error}</span>}
      {isViewMode && <span data-testid="view-mode">view</span>}
      {users.map((u) => (
        <span key={u.userId}>{u.username}</span>
      ))}
    </div>
  ),
}));

vi.mock("@widgets/layout/ProjectFormLayout", () => ({
  ProjectFormLayout: ({
    children,
    title,
    footer,
    stepInfo,
  }: {
    children: React.ReactNode;
    title: string;
    footer: React.ReactNode;
    stepInfo?: string;
  }) => (
    <div>
      <h2>{title}</h2>
      {stepInfo && <span>{stepInfo}</span>}
      {children}
      {footer}
    </div>
  ),
}));

const mockPaginated = {
  users: [
    { userId: 1, username: "alice", email: "alice@x.com" },
    { userId: 2, username: "bob", email: "bob@x.com" },
  ],
  totalItems: 2,
  isLoading: false,
  error: "",
  search: "",
  setSearch: vi.fn(),
  currentPage: 1,
  setCurrentPage: vi.fn(),
};

describe("ProjectTeamStep", () => {
  beforeEach(() => {
    usePaginatedUsersMock.mockReturnValue(mockPaginated);
  });

  it("renders 'Select Team Members' title in create mode", () => {
    renderWithProviders(
      <ProjectTeamStep
        mode="create"
        selectedUserIds={[]}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("Select Team Members")).toBeInTheDocument();
  });

  it("renders 'Manage Team Members' title in edit mode", () => {
    renderWithProviders(
      <ProjectTeamStep
        mode="edit"
        selectedUserIds={[]}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("Manage Team Members")).toBeInTheDocument();
  });

  it("renders 'Team Members' title in view mode", () => {
    renderWithProviders(
      <ProjectTeamStep
        mode="view"
        selectedUserIds={[]}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("Team Members")).toBeInTheDocument();
  });

  it("shows STEP 2 OF 2 in create mode", () => {
    renderWithProviders(
      <ProjectTeamStep
        mode="create"
        selectedUserIds={[]}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("STEP 2 OF 2")).toBeInTheDocument();
  });

  it("does not show step info in edit or view mode", () => {
    renderWithProviders(
      <ProjectTeamStep mode="edit" selectedUserIds={[]} onBack={vi.fn()} />
    );
    expect(screen.queryByText(/STEP/)).not.toBeInTheDocument();
  });

  it("renders users from usePaginatedUsers", () => {
    renderWithProviders(
      <ProjectTeamStep mode="edit" selectedUserIds={[]} onBack={vi.fn()} />
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("shows UserSelectorTable in view mode", () => {
    renderWithProviders(
      <ProjectTeamStep mode="view" selectedUserIds={[1]} onBack={vi.fn()} />
    );
    expect(screen.getByTestId("view-mode")).toBeInTheDocument();
  });

  it("shows 'Create Project' button in create mode", () => {
    renderWithProviders(
      <ProjectTeamStep
        mode="create"
        selectedUserIds={[]}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /create project/i })
    ).toBeInTheDocument();
  });

  it("shows 'Save Changes' button in edit mode", () => {
    renderWithProviders(
      <ProjectTeamStep
        mode="edit"
        selectedUserIds={[]}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectTeamStep mode="create" selectedUserIds={[]} onBack={onBack} />
    );
    await user.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onBack labeled Close in view mode", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectTeamStep mode="view" selectedUserIds={[]} onBack={onBack} />
    );
    await user.click(screen.getByText("Close"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Create Project is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProjectTeamStep
        mode="create"
        selectedUserIds={[]}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: /create project/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
