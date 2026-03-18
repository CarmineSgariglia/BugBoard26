import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BaseFolderCard } from "@features/project/ui/BaseFolderCard";
import { renderWithProviders } from "../../../render";

describe("BaseFolderCard", () => {
  it("renders children inside the folder body and applies the custom class", () => {
    const { container } = renderWithProviders(
      <BaseFolderCard color="#123456" className="custom-folder-body">
        <span>Folder content</span>
      </BaseFolderCard>
    );

    expect(screen.getByText("Folder content")).toBeInTheDocument();
    expect(container.querySelector(".custom-folder-body")).toBeInTheDocument();

    const coloredLayers = Array.from(container.querySelectorAll("div")).filter(
      (element) => element.getAttribute("style")?.includes("background-color")
    );

    expect(coloredLayers).toHaveLength(3);
  });

  it("calls onClick when the card is pressed", () => {
    const onClick = vi.fn();

    renderWithProviders(
      <BaseFolderCard color="#654321" onClick={onClick}>
        <span>Clickable folder</span>
      </BaseFolderCard>
    );

    fireEvent.click(screen.getByRole("button", { name: /clickable folder/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
