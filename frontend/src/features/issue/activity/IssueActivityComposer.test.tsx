import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render";
import { IssueActivityComposer } from "./IssueActivityComposer";

vi.mock("@shared/hooks/useFileValidation", () => ({
  useFileValidation: () => ({
    error: null,
    isPreparingFiles: false,
    handleFiles: vi.fn(),
    removeFile: vi.fn(),
  }),
}));

vi.mock("@shared/ui/AttachmentUploadInfoPopover", () => ({
  AttachmentUploadInfoPopover: () => null,
}));

type ComposerHarnessProps = {
  initialMessage?: string;
  onSubmit?: () => void;
};

function ComposerHarness({ initialMessage = "Hello", onSubmit = vi.fn() }: ComposerHarnessProps) {
  const [message, setMessage] = useState(initialMessage);

  return (
    <IssueActivityComposer
      message={message}
      onMessageChange={setMessage}
      files={[]}
      onFilesChange={() => {}}
      onSubmit={onSubmit}
      isSubmitting={false}
    />
  );
}

describe("IssueActivityComposer", () => {
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
});
