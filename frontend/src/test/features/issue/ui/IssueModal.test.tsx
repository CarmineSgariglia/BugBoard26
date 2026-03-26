import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IssueModal } from "../../../../features/issue/ui/IssueModal";
import { renderWithProviders } from "../../../render";
import { createProjectIssueApi } from "@features/project/api";
import { createIssueUpdateApi, updateIssueDetailsApi } from "@features/issue/api";

vi.mock("@features/project/api", () => ({
  createProjectIssueApi: vi.fn(),
  updateProjectApi: vi.fn(),
}));

vi.mock("@features/issue/api", () => ({
  updateIssueDetailsApi: vi.fn(),
  createIssueUpdateApi: vi.fn(),
}));

vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="modal-overlay">{children}</div> : null,
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
    tags: [{ name: "frontend" }],
  } as any;

  describe("Create Mode", () => {
    it("renders create issue layout with description field", () => {
      renderWithProviders(<IssueModal isOpen={true} onClose={vi.fn()} mode="create" projectId={1} />);

      expect(screen.getByText(/create new issue/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/what's the issue/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/provide more details/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create issue/i })).toBeInTheDocument();
    });

    it("keeps create submit active and marks invalid fields on submit", () => {
      renderWithProviders(<IssueModal isOpen={true} onClose={vi.fn()} mode="create" projectId={1} />);

      const submitBtn = screen.getByRole("button", { name: /create issue/i });
      expect(submitBtn).not.toHaveAttribute("disabled");

      fireEvent.click(submitBtn);

      expect(screen.getByText("Verifica i campi evidenziati.")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/what's the issue/i)).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByPlaceholderText(/provide more details/i)).toHaveAttribute("aria-invalid", "true");
    });

    it("calls createProjectIssueApi on submit click and shows success toast", async () => {
      vi.mocked(createProjectIssueApi).mockResolvedValue({ issueId: 45 } as any);
      vi.mocked(createIssueUpdateApi).mockResolvedValue({ updateId: 1 } as any);
      const onSuccess = vi.fn();

      renderWithProviders(
        <IssueModal isOpen={true} onClose={vi.fn()} mode="create" projectId={1} onSuccess={onSuccess} />,
      );

      fireEvent.change(screen.getByPlaceholderText(/what's the issue/i), {
        target: { value: "New Crash Bug" },
      });
      fireEvent.change(screen.getByPlaceholderText(/provide more details/i), {
        target: { value: "More than 5 characters description for valid payload triggers." },
      });

      fireEvent.click(screen.getByRole("button", { name: /create issue/i }));

      await vi.waitFor(() => {
        expect(createProjectIssueApi).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            title: "New Crash Bug",
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
      });
      expect(screen.getByText("Hai creato un nuovo issue")).toBeInTheDocument();
    });

    it("shows a non-blocking warning when issue creation succeeds but the first update fails", async () => {
      vi.mocked(createProjectIssueApi).mockResolvedValue({ issueId: 45 } as any);
      vi.mocked(createIssueUpdateApi).mockRejectedValue({
        response: {
          status: 403,
        },
      });
      const onSuccess = vi.fn();

      renderWithProviders(
        <IssueModal
          isOpen={true}
          onClose={vi.fn()}
          mode="create"
          projectId={1}
          onSuccess={onSuccess}
        />,
      );

      fireEvent.change(screen.getByPlaceholderText(/what's the issue/i), {
        target: { value: "New Crash Bug" },
      });
      fireEvent.change(screen.getByPlaceholderText(/provide more details/i), {
        target: { value: "More than 5 characters description for valid payload triggers." },
      });

      fireEvent.click(screen.getByRole("button", { name: /create issue/i }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Issue created, but first comment/attachments not saved (insufficient permissions).",
          ),
        ).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /issue created/i })).toBeInTheDocument();
      expect(screen.getByText("Close")).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("Edit Mode", () => {
    it("hydrates inputs with initialData and hides Description field", async () => {
      renderWithProviders(
        <IssueModal isOpen={true} onClose={vi.fn()} mode="edit" initialData={dummyIssue} issue={dummyIssue} />,
      );

      expect(screen.getByText(/edit issue/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/what's the issue/i)).toHaveValue("Original Issue Title");
      });

      expect(screen.queryByPlaceholderText(/provide more details/i)).not.toBeInTheDocument();
    });

    it("triggers updateIssueDetailsApi on Save Changes and shows edit success toast", async () => {
      vi.mocked(updateIssueDetailsApi).mockResolvedValue({ ...dummyIssue, title: "Modified Title" });
      const onSuccess = vi.fn();

      renderWithProviders(
        <IssueModal
          isOpen={true}
          onClose={vi.fn()}
          mode="edit"
          initialData={dummyIssue}
          issue={dummyIssue}
          onSuccess={onSuccess}
        />,
      );

      fireEvent.change(screen.getByPlaceholderText(/what's the issue/i), {
        target: { value: "Modified Title" },
      });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await vi.waitFor(() => {
        expect(updateIssueDetailsApi).toHaveBeenCalledWith(
          dummyIssue.issueId,
          expect.objectContaining({
            title: "Modified Title",
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
      });
      expect(screen.getByText("Issue modificato con successo.")).toBeInTheDocument();
    });

    it("keeps Save Changes disabled when no edit has been made", async () => {
      renderWithProviders(
        <IssueModal
          isOpen={true}
          onClose={vi.fn()}
          mode="edit"
          initialData={dummyIssue}
          issue={dummyIssue}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save changes/i })).toHaveAttribute("disabled");
      });
    });
  });
});
