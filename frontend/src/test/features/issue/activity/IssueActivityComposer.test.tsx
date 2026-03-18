import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../render";
import { IssueActivityComposer } from "@features/issue/activity/IssueActivityComposer";

const composerState = vi.hoisted(() => ({
  fileError: null as string | null,
  isPreparingFiles: false,
  handleFiles: vi.fn(),
  removeFile: vi.fn(),
}));

vi.mock("@features/issue/activity/useFileValidation", () => ({
  useFileValidation: () => ({
    error: composerState.fileError,
    isPreparingFiles: composerState.isPreparingFiles,
    handleFiles: composerState.handleFiles,
    removeFile: composerState.removeFile,
  }),
}));

vi.mock("@shared/ui/AttachmentUploadInfoPopover", () => ({
  AttachmentUploadInfoPopover: () => <div>Upload info</div>,
}));

type ComposerHarnessProps = {
  initialMessage?: string;
  initialFiles?: File[];
  isSubmitting?: boolean;
  onSubmit?: () => void;
};

function ComposerHarness({
  initialMessage = "Hello",
  initialFiles = [],
  isSubmitting = false,
  onSubmit = vi.fn(),
}: ComposerHarnessProps) {
  const [message, setMessage] = useState(initialMessage);
  const [files, setFiles] = useState<File[]>(initialFiles);

  return (
    <IssueActivityComposer
      message={message}
      onMessageChange={setMessage}
      files={files}
      onFilesChange={setFiles}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    />
  );
}

describe("IssueActivityComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    composerState.fileError = null;
    composerState.isPreparingFiles = false;
  });

  it("sends the message when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(<ComposerHarness onSubmit={onSubmit} />);

    const textbox = screen.getByRole("textbox", { name: "Comment" });
    await user.click(textbox);
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(textbox).toHaveValue("Hello");
  });

  it("does not send when the message is blank or the event is composing", () => {
    const onSubmit = vi.fn();
    renderWithProviders(<ComposerHarness initialMessage="" onSubmit={onSubmit} />);

    const textbox = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.keyDown(textbox, { key: "Enter" });
    fireEvent.keyDown(textbox, {
      key: "Enter",
      nativeEvent: { isComposing: true },
    } as unknown as KeyboardEvent);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("adds a new line instead of sending when Shift+Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(<ComposerHarness onSubmit={onSubmit} />);

    const textbox = screen.getByRole("textbox", { name: "Comment" });
    await user.click(textbox);
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textbox).toHaveValue("Hello\n");
  });

  it("disables the send button while submitting or preparing files", () => {
    composerState.isPreparingFiles = true;

    const { rerender } = renderWithProviders(
      <ComposerHarness initialMessage="Hello" isSubmitting={false} />
    );

    expect(screen.getByRole("button", { name: /send/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Optimizing media...")).toBeInTheDocument();

    composerState.isPreparingFiles = false;
    rerender(<ComposerHarness initialMessage="Hello" isSubmitting={true} />);

    expect(screen.getByRole("button", { name: /loading/i }).hasAttribute("disabled")).toBe(true);
  });

  it("shows file errors and forwards file selection to the validation hook", async () => {
    const user = userEvent.setup();
    composerState.fileError = "Unsupported file type.";

    renderWithProviders(<ComposerHarness />);

    expect(screen.getByText("Unsupported file type.")).toBeInTheDocument();
    expect(screen.getByText("Upload info")).toBeInTheDocument();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "report.txt", { type: "text/plain" });

    await user.click(screen.getByRole("button", { name: /add media\/file/i }));
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(composerState.handleFiles).toHaveBeenCalled();
  });

  it("shows extra files, toggles the expanded view and calls removeFile", async () => {
    const user = userEvent.setup();
    const files = [
      new File(["1"], "file1.txt", { type: "text/plain" }),
      new File(["2"], "file2.txt", { type: "text/plain" }),
      new File(["3"], "file3.txt", { type: "text/plain" }),
      new File(["4"], "file4.txt", { type: "text/plain" }),
    ];

    renderWithProviders(<ComposerHarness initialFiles={files} />);

    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.queryByText(/file4\.txt/i)).not.toBeInTheDocument();

    await user.click(screen.getByText("+1 more"));
    expect(screen.getByText(/file4\.txt/i)).toBeInTheDocument();
    expect(screen.getByText("Show less")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button").filter((button) =>
      button.querySelector("svg")
    );
    await user.click(removeButtons[removeButtons.length - 1]);

    expect(composerState.removeFile).toHaveBeenCalled();
  });
});
