import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DeleteProjectFlow } from "@features/project/flows/DeleteProjectFlow";
import { renderWithProviders } from "../../../render";

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
}));

// Mock generateConfirmationCode so we control the code shown
vi.mock("@features/project/lib/confirmationCode", () => ({
  generateConfirmationCode: () => "1234567890",
}));

const { deleteProjectApiMock } = vi.hoisted(() => ({
  deleteProjectApiMock: vi.fn(),
}));

vi.mock("@features/project/api", () => ({
  deleteProjectApi: deleteProjectApiMock,
  listProjectMembersApi: vi.fn(),
  updateProjectApi: vi.fn(),
  createProjectApi: vi.fn(),
  listProjectsApi: vi.fn(),
  getProjectApi: vi.fn(),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  projectId: 42,
  projectName: "Alpha Project",
};

describe("DeleteProjectFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteProjectApiMock.mockResolvedValue(undefined);
    navigateMock.mockReset();
  });

  it("does not render when isOpen is false", () => {
    renderWithProviders(
      <DeleteProjectFlow {...defaultProps} isOpen={false} />
    );
    expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();
  });

  it("renders the Delete Project title", () => {
    renderWithProviders(<DeleteProjectFlow {...defaultProps} />);
    expect(screen.getByText("Delete Project")).toBeInTheDocument();
  });

  it("shows the project name in the warning message", () => {
    renderWithProviders(<DeleteProjectFlow {...defaultProps} />);
    expect(screen.getByText(/"Alpha Project"/)).toBeInTheDocument();
  });

  it("shows the generated confirmation code", () => {
    renderWithProviders(<DeleteProjectFlow {...defaultProps} />);
    expect(screen.getByText("1234567890")).toBeInTheDocument();
  });

  it("keeps DELETE PROJECT button disabled when code not typed", () => {
    renderWithProviders(<DeleteProjectFlow {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /DELETE PROJECT/i });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("enables DELETE PROJECT button when correct code is typed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteProjectFlow {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type the code above...");
    await user.type(input, "1234567890");
    const btn = screen.getByRole("button", { name: /DELETE PROJECT/i });
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("does not enable button on wrong code", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteProjectFlow {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type the code above...");
    await user.type(input, "0000000000");
    expect(
      screen.getByRole("button", { name: /DELETE PROJECT/i }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("filters out non-digit characters from input", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteProjectFlow {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type the code above...");
    await user.type(input, "abc123");
    expect(input).toHaveValue("123");
  });

  it("calls deleteProjectApi, onClose and redirects to projects on successful delete", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <DeleteProjectFlow {...defaultProps} onClose={onClose} />
    );
    queryClient.setQueryData(["projects"], [
      {
        projectId: 42,
        name: "Alpha Project",
        description: "Alpha",
        color: "#000000",
        icon: "folder",
        createdAt: "2026-03-19T00:00:00.000Z",
        createdBy: 1,
      },
      {
        projectId: 77,
        name: "Beta Project",
        description: "Beta",
        color: "#ffffff",
        icon: "folder",
        createdAt: "2026-03-18T00:00:00.000Z",
        createdBy: 1,
      },
    ]);
    await user.type(
      screen.getByPlaceholderText("Type the code above..."),
      "1234567890"
    );
    await user.click(screen.getByRole("button", { name: /DELETE PROJECT/i }));
    await waitFor(() => {
      expect(deleteProjectApiMock).toHaveBeenCalledWith(42);
      expect(onClose).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/projects", { replace: true });
      expect(queryClient.getQueryData(["projects"])).toEqual([
        expect.objectContaining({ projectId: 77, name: "Beta Project" }),
      ]);
    });
    expect(await screen.findByText("Progetto rimosso con successo.")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DeleteProjectFlow {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
