import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IssuePage } from "@pages/issues/IssuePage";
import { renderWithProviders } from "../../render";

const issuePageState = vi.hoisted(() => ({
  getIssueApi: vi.fn(),
  listProjectMembersApi: vi.fn(),
  setLabel: vi.fn(),
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: {
      userId: 2,
      username: "devuser",
      email: "dev@example.com",
      isAdmin: false,
    },
    refreshUser: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@shared/providers/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({
    setLabel: issuePageState.setLabel,
  }),
}));

vi.mock("@features/issue/api", () => ({
  getIssueApi: issuePageState.getIssueApi,
}));

vi.mock("@features/project/api", () => ({
  listProjectMembersApi: issuePageState.listProjectMembersApi,
}));

vi.mock("@features/issue", () => ({
  IssueActivityPanel: ({
    issueId,
    issueTitle,
    canCompose,
  }: {
    issueId: number;
    issueTitle: string;
    canCompose: boolean;
  }) => (
    <div data-testid="issue-activity-panel">
      {issueId}:{issueTitle}:{String(canCompose)}
    </div>
  ),
  IssueDetailsSidebar: ({
    assignees,
    isAdmin,
    isAssigned,
    onEditClick,
    onManageMembersClick,
  }: {
    assignees: Array<{ username: string }>;
    isAdmin?: boolean;
    isAssigned: boolean;
    onEditClick: () => void;
    onManageMembersClick: () => void;
  }) => (
    <div data-testid="issue-details-sidebar">
      <span>assignees:{assignees.map((assignee) => assignee.username).join(",")}</span>
      <span>isAdmin:{String(isAdmin)}</span>
      <span>isAssigned:{String(isAssigned)}</span>
      <button onClick={onEditClick}>Open edit modal</button>
      <button onClick={onManageMembersClick}>Open assignees modal</button>
    </div>
  ),
  IssueAssigneesModal: ({
    isOpen,
    readOnly,
    onSuccess,
  }: {
    isOpen: boolean;
    readOnly: boolean;
    onSuccess: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>assignees-modal:{String(readOnly)}</span>
        <button onClick={onSuccess}>Confirm assignees</button>
      </div>
    ) : null,
  IssueModal: ({
    isOpen,
    onSuccess,
  }: {
    isOpen: boolean;
    onSuccess: () => void;
  }) =>
    isOpen ? <button onClick={onSuccess}>Confirm issue edit</button> : null,
}));

describe("IssuePage", () => {
  const issue = {
    issueId: 12,
    projectId: 7,
    reporterId: 5,
    reporter: {
      userId: 5,
      username: "reporter",
      email: "reporter@example.com",
    },
    title: "Broken login flow",
    description: "Users cannot complete the login flow.",
    type: "BUG",
    status: "OPEN",
    priority: "HIGH",
    createdAt: "2026-03-18T08:00:00Z",
    updatedAt: "2026-03-18T08:30:00Z",
    closedAt: null,
    tags: [],
    assignees: [
      { userId: 1, username: "admin" },
      { userId: 2, username: "devuser" },
      { userId: 3, username: "qa" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    issuePageState.getIssueApi.mockResolvedValue(issue);
    issuePageState.listProjectMembersApi.mockResolvedValue([
      { userId: 1, username: "admin", role: "ADMIN" },
      { userId: 2, username: "devuser", role: "MEMBER" },
      { userId: 3, username: "qa", role: "MEMBER" },
    ]);
  });

  it("loads the issue, updates the breadcrumb and filters admin assignees", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();
    expect(issuePageState.getIssueApi).toHaveBeenCalledWith("12");
    expect(issuePageState.listProjectMembersApi).toHaveBeenCalledWith(7);
    expect(issuePageState.setLabel).toHaveBeenCalledWith(
      "issue:12",
      "Broken login flow"
    );
    expect(
      await screen.findByText("assignees:devuser,qa")
    ).toBeInTheDocument();
    expect(screen.getByText("isAdmin:false")).toBeInTheDocument();
    expect(screen.getByText("isAssigned:true")).toBeInTheDocument();
    expect(
      screen.getByText("12:Broken login flow:true")
    ).toBeInTheDocument();
  });

  it("refetches and invalidates issue updates after modal success actions", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open assignees modal/i }));
    await user.click(screen.getByRole("button", { name: /confirm assignees/i }));

    await waitFor(() => {
      expect(issuePageState.getIssueApi).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText("assignees-modal:true")).toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["issue", 12, "updates"],
    });

    await user.click(screen.getByRole("button", { name: /open edit modal/i }));
    await user.click(screen.getByRole("button", { name: /confirm issue edit/i }));

    await waitFor(() => {
      expect(issuePageState.getIssueApi).toHaveBeenCalledTimes(3);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });
});
