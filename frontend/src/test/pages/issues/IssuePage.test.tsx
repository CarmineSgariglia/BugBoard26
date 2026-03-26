import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IssuePage } from "@pages/issues/IssuePage";
import { renderWithProviders } from "../../render";

const issuePageState = vi.hoisted(() => ({
  currentUser: {
    userId: 2,
    username: "devuser",
    email: "dev@example.com",
    isAdmin: false,
  },
  getIssueApi: vi.fn(),
  getIssueSubscriptionApi: vi.fn(),
  getProjectSubscriptionApi: vi.fn(),
  listProjectMembersApi: vi.fn(),
  subscribeToIssueApi: vi.fn(),
  unsubscribeFromIssueApi: vi.fn(),
  setLabel: vi.fn(),
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: issuePageState.currentUser,
    refreshUser: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@shared/providers/useBreadcrumbs", () => ({
  useBreadcrumbs: () => ({
    setLabel: issuePageState.setLabel,
  }),
}));

vi.mock("@features/issue/api", () => ({
  getIssueApi: issuePageState.getIssueApi,
}));

vi.mock("@features/project/api", () => ({
  getProjectSubscriptionApi: issuePageState.getProjectSubscriptionApi,
  listProjectMembersApi: issuePageState.listProjectMembersApi,
}));

vi.mock("@features/issue", () => ({
  IssueActivityPanel: ({
    issueId,
    issueTitle,
    canCompose,
    composeUnavailableMessage,
    projectMembers = [],
  }: {
    issueId: number;
    issueTitle: string;
    canCompose: boolean;
    composeUnavailableMessage?: string | null;
    projectMembers?: Array<{ firstName?: string; lastName?: string; username: string }>;
  }) => (
    <div data-testid="issue-activity-panel">
      {issueId}:{issueTitle}:{String(canCompose)}
      <span>composeUnavailableMessage:{composeUnavailableMessage || ""}</span>
      <span>
        members:
        {projectMembers
          .map((member) =>
            `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
              ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() + ` (${member.username})`
              : member.username
          )
          .join(",")}
      </span>
    </div>
  ),
  IssueDetailsSidebar: ({
    assignees,
    isAdmin,
    isAssigned,
    onEditClick,
    onManageMembersClick,
    subscriptionChecked,
    subscriptionDisabled,
    subscriptionDisabledReason,
    subscriptionError,
    onSubscriptionChange,
  }: {
    assignees: Array<{ username: string }>;
    isAdmin?: boolean;
    isAssigned: boolean;
    onEditClick: () => void;
    onManageMembersClick: () => void;
    subscriptionChecked?: boolean;
    subscriptionDisabled?: boolean;
    subscriptionDisabledReason?: string;
    subscriptionError?: string;
    onSubscriptionChange?: (checked: boolean) => void;
  }) => (
    <div data-testid="issue-details-sidebar">
      <span>assignees:{assignees.map((assignee) => assignee.username).join(",")}</span>
      <span>isAdmin:{String(isAdmin)}</span>
      <span>isAssigned:{String(isAssigned)}</span>
      <span>subscription:{String(subscriptionChecked)}</span>
      <span>subscriptionDisabled:{String(subscriptionDisabled)}</span>
      <span>subscriptionDisabledReason:{subscriptionDisabledReason || ""}</span>
      <span>subscriptionError:{subscriptionError || ""}</span>
      <button onClick={onEditClick}>Open edit modal</button>
      <button onClick={onManageMembersClick}>Open assignees modal</button>
      {isAdmin ? (
        <button
          onClick={() => onSubscriptionChange?.(!subscriptionChecked)}
          disabled={subscriptionDisabled}
        >
          Toggle subscription
        </button>
      ) : null}
    </div>
  ),
  getIssueSubscriptionApi: issuePageState.getIssueSubscriptionApi,
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
  subscribeToIssueApi: issuePageState.subscribeToIssueApi,
  unsubscribeFromIssueApi: issuePageState.unsubscribeFromIssueApi,
}));

describe("IssuePage", () => {
  function createAxiosStatusError(status: number) {
    return {
      isAxiosError: true,
      response: {
        status,
        data: {},
      },
    };
  }

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
    issuePageState.currentUser = {
      userId: 2,
      username: "devuser",
      email: "dev@example.com",
      isAdmin: false,
    };
    issuePageState.getIssueApi.mockResolvedValue(issue);
    issuePageState.getIssueSubscriptionApi.mockResolvedValue({
      subscribed: false,
    });
    issuePageState.getProjectSubscriptionApi.mockResolvedValue({
      subscribed: true,
    });
    issuePageState.listProjectMembersApi.mockResolvedValue([
      { userId: 1, username: "admin", firstName: "Admin", lastName: "User", role: "ADMIN" },
      { userId: 2, username: "devuser", firstName: "Dev", lastName: "User", role: "MEMBER" },
      { userId: 3, username: "qa", firstName: "Quality", lastName: "Analyst", role: "MEMBER" },
    ]);
    issuePageState.subscribeToIssueApi.mockResolvedValue(undefined);
    issuePageState.unsubscribeFromIssueApi.mockResolvedValue(undefined);
  });

  it("loads the issue, updates the breadcrumb and filters admin assignees", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();
    expect(issuePageState.getIssueApi).toHaveBeenCalledWith("12", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(issuePageState.listProjectMembersApi).toHaveBeenCalledWith(7, expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(issuePageState.setLabel).toHaveBeenCalledWith(
      "issue:12",
      "Broken login flow"
    );
    expect(
      await screen.findByText("assignees:devuser,qa")
    ).toBeInTheDocument();
    expect(screen.getByText("isAdmin:false")).toBeInTheDocument();
    expect(screen.getByText("isAssigned:true")).toBeInTheDocument();
    expect(issuePageState.getIssueSubscriptionApi).not.toHaveBeenCalled();
    expect(issuePageState.getProjectSubscriptionApi).not.toHaveBeenCalled();
    expect(
      screen.getByText("12:Broken login flow:true")
    ).toBeInTheDocument();
    expect(screen.getByText("composeUnavailableMessage:")).toBeInTheDocument();
    expect(
      screen.getByText("members:Admin User (admin),Dev User (devuser),Quality Analyst (qa)")
    ).toBeInTheDocument();
  });

  it("shows a not assigned message instead of the chat bar for non-assigned users", async () => {
    issuePageState.currentUser = {
      userId: 99,
      username: "outsider",
      email: "outsider@example.com",
      isAdmin: false,
    };

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-activity-panel")).toBeInTheDocument();
    expect(screen.getByText("12:Broken login flow:false")).toBeInTheDocument();
    expect(
      screen.getByText("composeUnavailableMessage:You are not assigned to this issue")
    ).toBeInTheDocument();
  });

  it("shows the done message instead of the chat bar for done issues", async () => {
    issuePageState.currentUser = {
      userId: 99,
      username: "outsider",
      email: "outsider@example.com",
      isAdmin: false,
    };
    issuePageState.getIssueApi.mockResolvedValue({
      ...issue,
      status: "DONE",
    });

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-activity-panel")).toBeInTheDocument();
    expect(screen.getByText("12:Broken login flow:false")).toBeInTheDocument();
    expect(
      screen.getByText("composeUnavailableMessage:This issue is marked as done.")
    ).toBeInTheDocument();
  });

  it("shows the cancelled message instead of the chat bar for cancelled issues", async () => {
    issuePageState.getIssueApi.mockResolvedValue({
      ...issue,
      status: "CANCELLED",
    });

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-activity-panel")).toBeInTheDocument();
    expect(screen.getByText("12:Broken login flow:false")).toBeInTheDocument();
    expect(
      screen.getByText("composeUnavailableMessage:This issue is cancelled.")
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

  it("loads the admin subscription state and toggles it", async () => {
    issuePageState.currentUser = {
      userId: 1,
      username: "admin",
      email: "admin@example.com",
      isAdmin: true,
    };
    issuePageState.getIssueSubscriptionApi
      .mockResolvedValueOnce({ subscribed: false })
      .mockResolvedValueOnce({ subscribed: true })
      .mockResolvedValueOnce({ subscribed: false });

    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();
    expect(issuePageState.getIssueSubscriptionApi).toHaveBeenCalledWith("12", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(issuePageState.getProjectSubscriptionApi).toHaveBeenCalledWith(7, expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(screen.getByText("isAdmin:true")).toBeInTheDocument();
    expect(screen.getByText("subscription:false")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("subscriptionDisabled:false")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /toggle subscription/i }));

    await waitFor(() => {
      expect(issuePageState.subscribeToIssueApi).toHaveBeenCalledWith("12");
    });
    await waitFor(() => {
      expect(screen.getByText("subscription:true")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /toggle subscription/i }));

    await waitFor(() => {
      expect(issuePageState.unsubscribeFromIssueApi).toHaveBeenCalledWith("12");
    });
    await waitFor(() => {
      expect(screen.getByText("subscription:false")).toBeInTheDocument();
    });
  });

  it("disables the issue toggle when project notifications are disabled", async () => {
    issuePageState.currentUser = {
      userId: 1,
      username: "admin",
      email: "admin@example.com",
      isAdmin: true,
    };
    issuePageState.getIssueSubscriptionApi.mockResolvedValue({
      subscribed: true,
    });
    issuePageState.getProjectSubscriptionApi.mockResolvedValue({
      subscribed: false,
    });

    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();
    await waitFor(() => {
      expect(issuePageState.getIssueSubscriptionApi).not.toHaveBeenCalled();
      expect(screen.getByText("subscription:false")).toBeInTheDocument();
      expect(screen.getByText("subscriptionDisabled:true")).toBeInTheDocument();
      expect(
        screen.getByText("subscriptionDisabledReason:Project notifications disabled")
      ).toBeInTheDocument();
      expect(screen.getByText("subscriptionError:")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /toggle subscription/i }));

    expect(issuePageState.unsubscribeFromIssueApi).not.toHaveBeenCalled();
    expect(issuePageState.subscribeToIssueApi).not.toHaveBeenCalled();
  });

  it("supports the on-off combination with project enabled and issue disabled", async () => {
    issuePageState.currentUser = {
      userId: 1,
      username: "admin",
      email: "admin@example.com",
      isAdmin: true,
    };
    issuePageState.getProjectSubscriptionApi.mockResolvedValue({ subscribed: true });
    issuePageState.getIssueSubscriptionApi.mockResolvedValue({ subscribed: false });

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();
    await waitFor(() => {
      expect(issuePageState.getProjectSubscriptionApi).toHaveBeenCalledWith(7, expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(issuePageState.getIssueSubscriptionApi).toHaveBeenCalledWith("12", expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(screen.getByText("subscription:false")).toBeInTheDocument();
      expect(screen.getByText("subscriptionDisabled:false")).toBeInTheDocument();
      expect(screen.getByText("subscriptionDisabledReason:")).toBeInTheDocument();
    });
  });

  it("supports the on-on combination with both project and issue enabled", async () => {
    issuePageState.currentUser = {
      userId: 1,
      username: "admin",
      email: "admin@example.com",
      isAdmin: true,
    };
    issuePageState.getProjectSubscriptionApi.mockResolvedValue({ subscribed: true });
    issuePageState.getIssueSubscriptionApi.mockResolvedValue({ subscribed: true });

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();
    await waitFor(() => {
      expect(issuePageState.getProjectSubscriptionApi).toHaveBeenCalledWith(7, expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(issuePageState.getIssueSubscriptionApi).toHaveBeenCalledWith("12", expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(screen.getByText("subscription:true")).toBeInTheDocument();
      expect(screen.getByText("subscriptionDisabled:false")).toBeInTheDocument();
    });
  });

  it("supports the off-off combination with project disabled and issue not loaded", async () => {
    issuePageState.currentUser = {
      userId: 1,
      username: "admin",
      email: "admin@example.com",
      isAdmin: true,
    };
    issuePageState.getProjectSubscriptionApi.mockResolvedValue({ subscribed: false });
    issuePageState.getIssueSubscriptionApi.mockResolvedValue({ subscribed: false });

    renderWithProviders(
      <Routes>
        <Route path="/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/issues/12" }
    );

    expect(await screen.findByTestId("issue-details-sidebar")).toBeInTheDocument();
    await waitFor(() => {
      expect(issuePageState.getProjectSubscriptionApi).toHaveBeenCalledWith(7, expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(issuePageState.getIssueSubscriptionApi).not.toHaveBeenCalled();
      expect(screen.getByText("subscription:false")).toBeInTheDocument();
      expect(screen.getByText("subscriptionDisabled:true")).toBeInTheDocument();
      expect(
        screen.getByText("subscriptionDisabledReason:Project notifications disabled")
      ).toBeInTheDocument();
    });
  });

  it("redirects to /projects when the issue becomes inaccessible with a 404 response", async () => {
    issuePageState.getIssueApi.mockRejectedValue(createAxiosStatusError(404));

    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="/projects" element={<div>Projects Home</div>} />
        <Route path="/projects/:projectId/issues/:issueId" element={<IssuePage />} />
      </Routes>,
      { route: "/projects/7/issues/12" }
    );

    queryClient.setQueryData(["projects"], [
      { projectId: 7, name: "Orbit" },
      { projectId: 14, name: "Nova" },
    ]);
    queryClient.setQueryData(["project", 7], { projectId: 7, name: "Orbit" });

    expect(await screen.findByText("Projects Home")).toBeInTheDocument();
    expect(queryClient.getQueryData(["projects"])).toEqual([
      { projectId: 14, name: "Nova" },
    ]);
    expect(queryClient.getQueryData(["project", 7])).toBeUndefined();
  });
});
