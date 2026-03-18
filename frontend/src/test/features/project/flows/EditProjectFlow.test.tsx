import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditProjectFlow } from "../../../../features/project/flows/EditProjectFlow";
import { renderWithProviders } from "../../../render";
import { updateProjectApi } from "@features/project/api";

// Mock API endpoint
vi.mock("@features/project/api", () => ({
  updateProjectApi: vi.fn(),
}));

// Mock ModalOverlay to simplify layout requirements
vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => 
    isOpen ? <div data-testid="modal-overlay">{children}</div> : null
}));

// Mock DeleteProjectFlow to isolate test surface
vi.mock("../../../../features/project/flows/DeleteProjectFlow", () => ({
  DeleteProjectFlow: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? <div data-testid="delete-project-modal">Delete Modal Open</div> : null
}));

describe("EditProjectFlow", () => {
  const dummyProject = {
    projectId: 1,
    name: "Original Project Name",
    description: "Original Description",
    descriptionHtml: "<p>Original Description</p>",
    icon: "🚀",
    color: "#4F46E5",
    createdAt: "2026-03-10T10:00:00Z",
    updatedAt: "2026-03-11T10:00:00Z",
    ownerId: 2,
    collaborators: []
  } as any;

  it("hydrates inputs with initial project data", () => {
    renderWithProviders(<EditProjectFlow project={dummyProject} onClose={vi.fn()} />);
    
    // Header check
    expect(screen.getByText(/edit project/i)).toBeInTheDocument();
    
    // Inputs hydration
    expect(screen.getByPlaceholderText(/project title/i)).toHaveValue("Original Project Name");
  });

  it("calls updateProjectApi and triggers onUpdated when flow completes", async () => {
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    vi.mocked(updateProjectApi).mockResolvedValue({ ...dummyProject, name: "Updated Name" });

    renderWithProviders(<EditProjectFlow project={dummyProject} onClose={onClose} onUpdated={onUpdated} />);
    
    // Modify Title
    const titleInput = screen.getByPlaceholderText(/project title/i);
    fireEvent.change(titleInput, { target: { value: "Updated Name" } });

    // Click Confirm
    const saveBtn = screen.getByRole("button", { name: /confirm/i });
    fireEvent.click(saveBtn);

    // Wait for async mutation to solve and trigger callbacks
    await vi.waitFor(() => {
        expect(updateProjectApi).toHaveBeenCalled();
        expect(onUpdated).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
  });

  it("opens delete modal when Delete Project is clicked", async () => {
    renderWithProviders(<EditProjectFlow project={dummyProject} onClose={vi.fn()} />);
    
    const deleteBtn = screen.getByRole("button", { name: /delete project/i });
    fireEvent.click(deleteBtn);

    await vi.waitFor(() => {
        expect(screen.getByTestId("delete-project-modal")).toBeInTheDocument();
    });
  });
});
