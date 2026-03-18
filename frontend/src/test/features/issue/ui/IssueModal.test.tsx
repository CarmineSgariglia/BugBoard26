import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IssueModal } from "../../../../features/issue/ui/IssueModal";
import { renderWithProviders } from "../../../render";
import { createProjectIssueApi } from "@features/project/api";
import { updateIssueDetailsApi } from "@features/issue/api";

// Mock API endpoints
vi.mock("@features/project/api", () => ({
  createProjectIssueApi: vi.fn(),
  updateProjectApi: vi.fn() // Just in case
}));

vi.mock("@features/issue/api", () => ({
  updateIssueDetailsApi: vi.fn(),
  createIssueUpdateApi: vi.fn(),
}));

// Mock ModalOverlay to simplify layout requirements
vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => 
    isOpen ? <div data-testid="modal-overlay">{children}</div> : null
}));

describe("IssueModal", () => {
  const dummyIssue = {
    issueId: 44,
    title: "Original Issue Title",
    description: "Original description contents details",
    status: "TODO",
    priority: "HIGH",
    type: "BUG",
    projectId: 1,
    createdAt: "2026-03-10T10:00:00Z",
    tags: [{ name: "frontend" }]
  } as any;

  describe("Create Mode", () => {
    it("renders create issue layout with description field", () => {
      renderWithProviders(<IssueModal isOpen={true} onClose={vi.fn()} mode="create" projectId={1} />);
      
      expect(screen.getByText(/create new issue/i)).toBeInTheDocument();
      
      // Should show Title & Description inputs
      expect(screen.getByPlaceholderText(/what's the issue/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/provide more details/i)).toBeInTheDocument();
      
      // Button text
      expect(screen.getByRole("button", { name: /create issue/i })).toBeInTheDocument();
    });

    it("requires form validations to enable submit", () => {
      renderWithProviders(<IssueModal isOpen={true} onClose={vi.fn()} mode="create" projectId={1} />);
      
      const submitBtn = screen.getByRole("button", { name: /create issue/i });
      expect(submitBtn).toHaveAttribute("disabled");

      // Fill Title
      fireEvent.change(screen.getByPlaceholderText(/what's the issue/i), { target: { value: "A new bug" } });
      expect(submitBtn).toHaveAttribute("disabled"); // Still missing description

      // Fill Description
      fireEvent.change(screen.getByPlaceholderText(/provide more details/i), { target: { value: "Valid description here" } });
      expect(submitBtn).not.toHaveAttribute("disabled");
    });

    it("calls createProjectIssueApi on submit click", async () => {
      vi.mocked(createProjectIssueApi).mockResolvedValue({ issueId: 45 } as any);
      const onSuccess = vi.fn();

      renderWithProviders(<IssueModal isOpen={true} onClose={vi.fn()} mode="create" projectId={1} onSuccess={onSuccess} />);
      
      fireEvent.change(screen.getByPlaceholderText(/what's the issue/i), { target: { value: "New Crash Bug" } });
      fireEvent.change(screen.getByPlaceholderText(/provide more details/i), { target: { value: "More than 5 characters description for valid payload triggers." } });

      const submitBtn = screen.getByRole("button", { name: /create issue/i });
      fireEvent.click(submitBtn);

      await vi.waitFor(() => {
          expect(createProjectIssueApi).toHaveBeenCalledWith(1, expect.objectContaining({
              title: "New Crash Bug"
          }));
          expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("Edit Mode", () => {
    it("hydrates inputs with initialData and hides Description field", () => {
      renderWithProviders(<IssueModal isOpen={true} onClose={vi.fn()} mode="edit" initialData={dummyIssue} issue={dummyIssue} />);
      
      expect(screen.getByText(/edit issue/i)).toBeInTheDocument();
      
      // Hydration
      expect(screen.getByPlaceholderText(/what's the issue/i)).toHaveValue("Original Issue Title");
      
      // Description input should NOT be rendered in edit mode inside this modal layer
      expect(screen.queryByPlaceholderText(/provide more details/i)).not.toBeInTheDocument();
    });

    it("triggers updateIssueDetailsApi on Save Changes", async () => {
      vi.mocked(updateIssueDetailsApi).mockResolvedValue({ ...dummyIssue, title: "Modified Title" });
      const onSuccess = vi.fn();

      renderWithProviders(<IssueModal isOpen={true} onClose={vi.fn()} mode="edit" initialData={dummyIssue} issue={dummyIssue} onSuccess={onSuccess} />);
      
      // Trigger state updates
      const titleInput = screen.getByPlaceholderText(/what's the issue/i);
      fireEvent.change(titleInput, { target: { value: "Modified Title" } });

      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveBtn);

      await vi.waitFor(() => {
          expect(updateIssueDetailsApi).toHaveBeenCalledWith(dummyIssue.issueId, expect.objectContaining({
              title: "Modified Title"
          }));
          expect(onSuccess).toHaveBeenCalled();
      });
    });
  });
});
