import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AttachmentUploadInfoPopover } from "@shared/ui/AttachmentUploadInfoPopover";

describe("AttachmentUploadInfoPopover", () => {
  it("toggles popover open and close on click", async () => {
    const user = userEvent.setup();
    render(<AttachmentUploadInfoPopover />);

    const infoButton = screen.getByRole("button", { name: /file formats/i });
    expect(infoButton).toBeInTheDocument();

    expect(screen.queryByText("Accepted uploads")).not.toBeInTheDocument();

    await user.click(infoButton);
    expect(screen.getByText("Accepted uploads")).toBeInTheDocument();

    await user.click(infoButton);
    expect(screen.queryByText("Accepted uploads")).not.toBeInTheDocument();
  });
});
