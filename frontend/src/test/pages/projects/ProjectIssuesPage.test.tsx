import { QueryClient } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectIssuesPage } from "@pages/projects/ProjectIssuesPage";
import { renderWithProviders } from "../../render";

const projectIssuesPageState = vi.hoisted(() => ({
  currentUser: {
    userId: 11,
    username: "adminuser",
    email: "admin@example.com",
    isAdmin: true,
  },
  getProjectApi: vi.fn(),
  listProjectIssuesApi: vi.fn(),
  listProjectMembersApi: vi.fn(),
  getProjectSubscriptionApi: vi.fn(),
  subscribeToProjectApi: vi.fn(),
  unsubscribeFromProjectApi: vi.fn(),
  setLabel: vi.fn(),
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: projectIssuesPageState.currentUser,
    refreshUser: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@shared/providers/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({
    setLabel: projectIssuesPageState.setLabel,
  }),
}));

vi.mock("@features/project/api", () => ({
  getProjectApi: projectIssuesPageState.getProjectApi,
  listProjectIssuesApi: projectIssuesPageState.listProjectIssuesApi,
  listProjectMembersApi: projectIssuesPageState.listProjectMembersApi,
  getProjectSubscriptionApi: projectIssuesPageState.getProjectSubscriptionApi,
  subscribeToProjectApi: projectIssuesPageState.subscribeToProjectApi,
  unsubscribeFromProjectApi: projectIssuesPageState.unsubscribeFromProjectApi,
}));

vi.mock("@features/project/ui/ProjectSidebar", () => ({
  ProjectSidebar: ({
    isAdmin,
    subscriptionChecked,
    subscriptionDisabled,
    subscriptionError,
    onSubscriptionChange,
  }: {
    isAdmin?: boolean;
    subscriptionChecked?: boolean;
    subscriptionDisabled?: boolean;
    subscriptionError?: string;
    onSubscriptionChange?: (checked: boolean) => void;
  }) => (
    <div data-testid="project-sidebar">
      <span>isAdmin:{String(isAdmin)}</span>
      <span>subscription:{String(subscriptionChecked)}</span>
      <span>subscriptionDisabled:{String(subscriptionDisabled)}</span>
      <span>subscriptionError:{subscriptionError || ""}</span>
      {isAdmin ? (
        <button
          type="button"
          onClick={() => onSubscriptionChange?.(!subscriptionChecked)}
          disabled={subscriptionDisabled}
        >
          Toggle subscription
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@features/project/flows/EditProjectFlow", () => ({
  EditProjectFlow: () => null,
}));

vi.mock("@features/project/flows/EditTeamFlow", () => ({
  EditTeamFlow: () => null,
}));

vi.mock("@features/issue/ui/IssueModal", () => ({
  IssueModal: () => null,
}));

vi.mock("@shared/hooks", () => ({
  useFluidWheelContainer: () => ({ current: null }),
}));

vi.mock("@shared/ui/Button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@shared/ui/SearchBar", () => ({
  SearchBar: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="Search issues"
      value={value}
      onChange={(event) => onChange(event.target.value)}
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
    options: Array<{ value: string; label: string }>;
  }) => (
    <select
      aria-label="filter"
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

vi.mock("@widgets/layout/SidebarLayout", () => ({
  SidebarLayout: ({
    sidebar,
    children,
  }: {
    sidebar: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@features/issue/ui/IssueCard", () => ({
  IssueCard: ({ issue }: { issue: { title: string } }) => (
    <div data-testid="issue-card">{issue.title}</div>
  ),
}));

describe("ProjectIssuesPage", () => {
  function createAxiosStatusError(status: number) {
    return {
      isAxiosError: true,
      response: {
        status,
        data: {},
      },
    };
  }

  const project = {
    projectId: 7,
    name: "Orbit",
    createdAt: "2026-03-18T10:00:00.000Z",
    description: "Mission control dashboard.",
    color: "#1F2937",
    icon: "rocket",
    createdBy: 11,
  };

  const issue = {
    issueId: 12,
    projectId: 7,
    title: "Broken login flow",
    description: "Users cannot complete the login flow.",
    status: "OPEN",
    priority: "HIGH",
    type: "BUG",
    createdAt: "2026-03-18T08:00:00Z",
    assignees: [{ userId: 22, username: "devuser" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    projectIssuesPageState.currentUser = {
      userId: 11,
      username: "adminuser",
      email: "admin@example.com",
      isAdmin: true,
    };
    projectIssuesPageState.getProjectApi.mockResolvedValue(project);
    projectIssuesPageState.listProjectIssuesApi.mockResolvedValue([issue]);
    projectIssuesPageState.listProjectMembersApi.mockResolvedValue([
      { userId: 11, username: "adminuser", role: "ADMIN" },
      { userId: 22, username: "devuser", role: "MEMBER" },
    ]);
    projectIssuesPageState.getProjectSubscriptionApi.mockResolvedValue({
      subscribed: false,
    });
    projectIssuesPageState.subscribeToProjectApi.mockResolvedValue(undefined);
    projectIssuesPageState.unsubscribeFromProjectApi.mockResolvedValue(undefined);
  });

  it("loads the admin subscription state and toggles it with subscribe then unsubscribe", async () => {
    projectIssuesPageState.getProjectSubscriptionApi
      .mockResolvedValueOnce({ subscribed: false })
      .mockResolvedValueOnce({ subscribed: true })
      .mockResolvedValueOnce({ subscribed: false });

    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/projects/:projectId/issues" element={<ProjectIssuesPage />} />
      </Routes>,
      { route: "/projects/7/issues" }
    );

    expect(await screen.findByTestId("project-sidebar")).toBeInTheDocument();
    expect(projectIssuesPageState.getProjectApi).toHaveBeenCalledWith("7", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(projectIssuesPageState.listProjectIssuesApi).toHaveBeenCalledWith("7", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(projectIssuesPageState.listProjectMembersApi).toHaveBeenCalledWith("7", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(projectIssuesPageState.getProjectSubscriptionApi).toHaveBeenCalledWith("7", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(projectIssuesPageState.setLabel).toHaveBeenCalledWith("project:7", "Orbit");
    expect(screen.getByText("subscription:false")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /toggle subscription/i }));

    await waitFor(() => {
      expect(projectIssuesPageState.subscribeToProjectApi).toHaveBeenCalledWith("7");
    });
    await waitFor(() => {
      expect(screen.getByText("subscription:true")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /toggle subscription/i }));

    await waitFor(() => {
      expect(projectIssuesPageState.unsubscribeFromProjectApi).toHaveBeenCalledWith("7");
    });
    await waitFor(() => {
      expect(screen.getByText("subscription:false")).toBeInTheDocument();
    });
  });

  it("does not fetch project subscription state for developers", async () => {
    projectIssuesPageState.currentUser = {
      userId: 22,
      username: "devuser",
      email: "dev@example.com",
      isAdmin: false,
    };

    renderWithProviders(
      <Routes>
        <Route path="/projects/:projectId/issues" element={<ProjectIssuesPage />} />
      </Routes>,
      { route: "/projects/7/issues" }
    );

    expect(await screen.findByTestId("project-sidebar")).toBeInTheDocument();
    expect(projectIssuesPageState.getProjectSubscriptionApi).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /toggle subscription/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("isAdmin:false")).toBeInTheDocument();
  });

  it("redirects to /projects when project access is revoked with a 403 response", async () => {
    projectIssuesPageState.getProjectApi.mockRejectedValue(createAxiosStatusError(403));
    projectIssuesPageState.listProjectIssuesApi.mockRejectedValue(createAxiosStatusError(403));
    projectIssuesPageState.listProjectMembersApi.mockRejectedValue(createAxiosStatusError(403));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          gcTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    });
    queryClient.setQueryData(["projects"], [
      { projectId: 7, name: "Orbit" },
      { projectId: 14, name: "Nova" },
    ]);
    queryClient.setQueryData(["project", "7"], { projectId: 7, name: "Orbit" });

    renderWithProviders(
      <Routes>
        <Route path="/projects" element={<div>Projects Home</div>} />
        <Route path="/projects/:projectId/issues" element={<ProjectIssuesPage />} />
      </Routes>,
      { route: "/projects/7/issues", queryClient }
    );

    expect(await screen.findByText("Projects Home")).toBeInTheDocument();
    expect(queryClient.getQueryData(["projects"])).toEqual([
      { projectId: 14, name: "Nova" },
    ]);
    expect(queryClient.getQueryData(["project", "7"])).toBeUndefined();
  });
});
