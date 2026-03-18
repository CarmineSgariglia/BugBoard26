import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditTeamFlow } from "@features/project/flows/EditTeamFlow";
import { renderWithProviders } from "../../../render";
import type { Project } from "@shared/api/types/projects";

vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
}));

vi.mock("@features/project/flows/ProjectTeamStep", () => ({
  ProjectTeamStep: ({
    mode,
    selectedUserIds,
    onToggleUser,
    onBack,
    onConfirm,
    isSubmitting,
  }: {
    mode: string;
    selectedUserIds: number[];
    onToggleUser?: (userId: number) => void;
    onBack: () => void;
    onConfirm?: () => void;
    isSubmitting?: boolean;
  }) => (
    <div data-testid="project-team-step" data-mode={mode}>
      <span>selected:{selectedUserIds.join(",")}</span>
      <button onClick={onBack}>Back</button>
      {onToggleUser && <button onClick={() => onToggleUser(3)}>Toggle user 3</button>}
      {onConfirm && (
        <button onClick={onConfirm} disabled={isSubmitting}>
          Save Changes
        </button>
      )}
    </div>
  ),
}));

const {
  listProjectMembersApiMock,
  updateProjectApiMock,
} = vi.hoisted(() => ({
  listProjectMembersApiMock: vi.fn(),
  updateProjectApiMock: vi.fn(),
}));

vi.mock("@features/project/api", () => ({
  listProjectMembersApi: listProjectMembersApiMock,
  updateProjectApi: updateProjectApiMock,
  createProjectApi: vi.fn(),
  deleteProjectApi: vi.fn(),
  listProjectsApi: vi.fn(),
  getProjectApi: vi.fn(),
  listProjectIssuesApi: vi.fn(),
  createProjectIssueApi: vi.fn(),
}));

const baseProject: Project = {
  projectId: 7,
  name: "Test Project",
  description: "desc",
  icon: "folder",
  color: "#fff",
  team: [],
} as any;

const mockMembers = [
  { userId: 1, username: "admin", role: "ADMIN", email: "admin@x.com" },
  { userId: 2, username: "alice", role: "MEMBER", email: "alice@x.com" },
];

describe("EditTeamFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProjectMembersApiMock.mockResolvedValue(mockMembers);
    updateProjectApiMock.mockResolvedValue(baseProject);
  });

  it("renders the modal overlay", () => {
    renderWithProviders(<EditTeamFlow project={baseProject} onClose={vi.fn()} />);

    expect(screen.getByTestId("modal-overlay")).toBeInTheDocument();
  });

  it("shows loading while members are still being fetched", () => {
    listProjectMembersApiMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockMembers), 50);
        })
    );

    renderWithProviders(<EditTeamFlow project={baseProject} onClose={vi.fn()} />);

    expect(screen.getByText("Loading team members...")).toBeInTheDocument();
  });

  it("renders ProjectTeamStep in edit mode after loading members", async () => {
    renderWithProviders(<EditTeamFlow project={baseProject} onClose={vi.fn()} />);

    expect(await screen.findByTestId("project-team-step")).toBeInTheDocument();
    expect(screen.getByTestId("project-team-step")).toHaveAttribute(
      "data-mode",
      "edit"
    );
    expect(screen.getByText("selected:2")).toBeInTheDocument();
  });

  it("renders ProjectTeamStep in view mode when readOnly is true", async () => {
    renderWithProviders(
      <EditTeamFlow project={baseProject} onClose={vi.fn()} readOnly />
    );

    expect(await screen.findByTestId("project-team-step")).toHaveAttribute(
      "data-mode",
      "view"
    );
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });

  it("calls onClose when Back is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<EditTeamFlow project={baseProject} onClose={onClose} />);

    await user.click(await screen.findByText("Back"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates the team with admins plus selected users and calls callbacks", async () => {
    const onClose = vi.fn();
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <EditTeamFlow
        project={baseProject}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    );

    await screen.findByTestId("project-team-step");
    await user.click(screen.getByRole("button", { name: /toggle user 3/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateProjectApiMock).toHaveBeenCalledWith(7, { team: [1, 2, 3] });
    });

    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when loading members fails", async () => {
    listProjectMembersApiMock.mockRejectedValue(new Error("failed"));

    renderWithProviders(<EditTeamFlow project={baseProject} onClose={vi.fn()} />);

    expect(
      await screen.findByText("Error loading team members.")
    ).toBeInTheDocument();
  });

  it("shows an error message when updating the team fails", async () => {
    updateProjectApiMock.mockRejectedValue(new Error("update failed"));
    const user = userEvent.setup();

    renderWithProviders(<EditTeamFlow project={baseProject} onClose={vi.fn()} />);

    await screen.findByTestId("project-team-step");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText("Error updating the team. Please try again.")
    ).toBeInTheDocument();
  });
});
