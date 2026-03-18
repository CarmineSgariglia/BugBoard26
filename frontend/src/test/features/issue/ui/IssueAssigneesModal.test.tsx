import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IssueAssigneesModal } from "@features/issue/ui/IssueAssigneesModal";
import { renderWithProviders } from "../../../render";
import type { Issue } from "@shared/api/types/issues";

vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
}));

vi.mock("@widgets/layout/ProjectFormLayout", () => ({
  ProjectFormLayout: ({
    children,
    title,
    subtitle,
    footer,
  }: {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    footer?: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      <div data-testid="form-body">{children}</div>
      {footer ? <div data-testid="form-footer">{footer}</div> : null}
    </div>
  ),
}));

vi.mock("@shared/ui/FooterActions", () => ({
  FooterActions: ({
    onSave,
    links,
    showSave,
    isSaving,
    isSaveEnabled,
    saveLabel,
  }: {
    onSave?: () => void;
    links?: Array<{ label: string; onClick: () => void }>;
    showSave?: boolean;
    isSaving?: boolean;
    isSaveEnabled?: boolean;
    saveLabel?: string;
  }) => (
    <div>
      {links?.map((link) => (
        <button key={link.label} onClick={link.onClick}>
          {link.label}
        </button>
      ))}
      {showSave ? (
        <button onClick={onSave} disabled={!isSaveEnabled || isSaving}>
          {saveLabel ?? "Save Changes"}
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@shared/ui/UserSelectorTable", () => ({
  UserSelectorTable: ({
    users,
    selectedUserIds,
    onToggleUser,
    isLoading,
    error,
    isViewMode,
    suggestedMetaByUserId,
  }: {
    users: Array<{ userId: number; username: string }>;
    selectedUserIds: number[];
    onToggleUser?: (userId: number) => void;
    isLoading?: boolean;
    error?: string;
    isViewMode?: boolean;
    suggestedMetaByUserId?: Record<number, { openAssignments: number; rank: number }>;
  }) => (
    <div data-testid="user-selector-table">
      <span>selected:{selectedUserIds.join(",")}</span>
      <span>view-mode:{String(Boolean(isViewMode))}</span>
      {isLoading ? <span>Loading...</span> : null}
      {error ? <span>{error}</span> : null}
      {users.map((user) => (
        <div key={user.userId}>
          <span>{user.username}</span>
          <span>{`suggested:${suggestedMetaByUserId?.[user.userId]?.rank ?? "none"}`}</span>
          {onToggleUser ? (
            <button onClick={() => onToggleUser(user.userId)}>
              Toggle {user.username}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  ),
}));

const {
  listProjectMembersApiMock,
  listIssueSuggestionsApiMock,
  assignIssueUsersApiMock,
  unassignIssueUsersApiMock,
  getIssueApiMock,
} = vi.hoisted(() => ({
  listProjectMembersApiMock: vi.fn(),
  listIssueSuggestionsApiMock: vi.fn(),
  assignIssueUsersApiMock: vi.fn(),
  unassignIssueUsersApiMock: vi.fn(),
  getIssueApiMock: vi.fn(),
}));

vi.mock("@features/issue/api", () => ({
  listIssueSuggestionsApi: listIssueSuggestionsApiMock,
  assignIssueUsersApi: assignIssueUsersApiMock,
  unassignIssueUsersApi: unassignIssueUsersApiMock,
  getIssueApi: getIssueApiMock,
}));

vi.mock("@features/project/api", () => ({
  listProjectMembersApi: listProjectMembersApiMock,
}));

const baseIssue: Issue = {
  issueId: 10,
  projectId: 1,
  title: "Test Issue",
  description: "desc",
  status: "TODO",
  priority: "LOW",
  type: "BUG",
  assignees: [],
  tags: [],
  createdAt: "2026-01-01T00:00:00Z",
} as any;

const mockMembers = [
  {
    userId: 1,
    username: "admin",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "A",
    profileImg: null,
    role: "ADMIN",
  },
  {
    userId: 2,
    username: "alice",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "A",
    profileImg: null,
    role: "MEMBER",
  },
  {
    userId: 3,
    username: "bob",
    email: "bob@example.com",
    firstName: "Bob",
    lastName: "B",
    profileImg: null,
    role: "MEMBER",
  },
];

describe("IssueAssigneesModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProjectMembersApiMock.mockResolvedValue(mockMembers);
    listIssueSuggestionsApiMock.mockResolvedValue([
      { userId: 3, openAssignments: 2, suggestionScore: 0.9 },
      { userId: 2, openAssignments: 1, suggestionScore: 0.8 },
    ]);
    assignIssueUsersApiMock.mockResolvedValue(undefined);
    unassignIssueUsersApiMock.mockResolvedValue(undefined);
    getIssueApiMock.mockResolvedValue(baseIssue);
  });

  it("does not render when closed", () => {
    renderWithProviders(
      <IssueAssigneesModal
        issue={baseIssue}
        isOpen={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();
  });

  it("renders edit mode, filters admin members and initializes selected assignees", async () => {
    const issueWithAssignees: Issue = {
      ...baseIssue,
      assignees: [
        { userId: 1, username: "admin" },
        { userId: 2, username: "alice" },
      ],
    } as any;

    renderWithProviders(
      <IssueAssigneesModal
        issue={issueWithAssignees}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(await screen.findByText("Manage Assignees")).toBeInTheDocument();
    expect(screen.getByText("Assign team members to issue #10")).toBeInTheDocument();
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
    expect(await screen.findByText("selected:2")).toBeInTheDocument();
    expect(screen.getByText("suggested:0")).toBeInTheDocument();
    expect(screen.getByText("suggested:1")).toBeInTheDocument();
  });

  it("renders read-only mode without save and toggle controls", async () => {
    renderWithProviders(
      <IssueAssigneesModal
        issue={baseIssue}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        readOnly
      />
    );

    expect(await screen.findByText("Team Members")).toBeInTheDocument();
    expect(screen.getByText("Members for issue #10")).toBeInTheDocument();
    expect(screen.getByText("view-mode:true")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /toggle alice/i })).not.toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <IssueAssigneesModal
        issue={baseIssue}
        isOpen={true}
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("assigns and unassigns the correct users before returning the refreshed issue", async () => {
    const issueWithAssignees: Issue = {
      ...baseIssue,
      assignees: [
        { userId: 1, username: "admin" },
        { userId: 2, username: "alice" },
      ],
    } as any;
    const refreshedIssue = {
      ...issueWithAssignees,
      assignees: [{ userId: 3, username: "bob" }],
    } as any;
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    getIssueApiMock.mockResolvedValue(refreshedIssue);

    renderWithProviders(
      <IssueAssigneesModal
        issue={issueWithAssignees}
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await screen.findByRole("button", { name: /toggle alice/i });
    await user.click(screen.getByRole("button", { name: /toggle alice/i }));
    await user.click(screen.getByRole("button", { name: /toggle bob/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(assignIssueUsersApiMock).toHaveBeenCalledWith(10, [3]);
      expect(unassignIssueUsersApiMock).toHaveBeenCalledWith(10, [2]);
      expect(getIssueApiMock).toHaveBeenCalledWith(10);
      expect(onSuccess).toHaveBeenCalledWith(refreshedIssue);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a loading state while members or suggestions are still loading", () => {
    listProjectMembersApiMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockMembers), 50);
        })
    );

    renderWithProviders(
      <IssueAssigneesModal
        issue={baseIssue}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows a member-loading error in the selector", async () => {
    listProjectMembersApiMock.mockRejectedValue(new Error("load failed"));

    renderWithProviders(
      <IssueAssigneesModal
        issue={baseIssue}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(
      await screen.findByText("Failed to load project members.")
    ).toBeInTheDocument();
  });

  it("shows an update error when saving assignees fails", async () => {
    assignIssueUsersApiMock.mockRejectedValue(new Error("save failed"));
    const issueWithAssignees: Issue = {
      ...baseIssue,
      assignees: [],
    } as any;
    const user = userEvent.setup();

    renderWithProviders(
      <IssueAssigneesModal
        issue={issueWithAssignees}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await screen.findByRole("button", { name: /toggle bob/i });
    await user.click(screen.getByRole("button", { name: /toggle bob/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText("Failed to update assignees.")
    ).toBeInTheDocument();
  });
});
