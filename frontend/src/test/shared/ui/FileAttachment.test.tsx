import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileAttachment } from "@features/issue/ui/FileAttachment";

// Mock useFileValidation
vi.mock("@features/issue/activity/useFileValidation", () => ({
  useFileValidation: vi.fn(() => ({
    files: [
      new File(["temp"], "doc.pdf", { type: "application/pdf" }),
    ],
    error: null,
    isPreparingFiles: false,
    handleFiles: vi.fn(),
    removeFile: vi.fn(),
  })),
}));

describe("FileAttachment", () => {
  it("renders drag & drop zone and file list", () => {
    render(<FileAttachment onFilesChange={() => {}} />);
    
    expect(screen.getByText(/Drag files here/i)).toBeInTheDocument();
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
  });

  it("triggers removeFile when delete button clicked", async () => {
    const user = userEvent.setup();
    const { useFileValidation } = await import("@features/issue/activity/useFileValidation");
    const mockRemoveFile = vi.fn();
    
    vi.mocked(useFileValidation).mockReturnValue({
      files: [new File([""], "test.txt")],
      error: null,
      isPreparingFiles: false,
      handleFiles: vi.fn(),
      removeFile: mockRemoveFile,
      resetFiles: vi.fn(),
    });

    render(<FileAttachment onFilesChange={() => {}} />);
    
    const buttons = screen.getAllByRole("button");
    
    await user.click(buttons[buttons.length - 1]);
    expect(mockRemoveFile).toHaveBeenCalledWith(0);
  });
});
