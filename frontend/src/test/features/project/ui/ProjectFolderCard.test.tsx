import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ProjectFolderCard } from "@features/project/ui/ProjectFolderCard";
import { renderWithProviders } from "../../../render";
import { getContrastColor } from "@features/project/lib/color";

vi.mock("@features/project/lib/color", () => ({
  getContrastColor: vi.fn((_color: string, opacity: number) => `rgba(0, 0, 0, ${opacity})`),
}));

describe("ProjectFolderCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the project information and author image", () => {
    renderWithProviders(
      <ProjectFolderCard
        color="#2A4365"
        title="Roadmap"
        description="Platform work and delivery milestones."
        icon={<span>PF</span>}
        date="18 Mar 2026"
        authorImageUrl="https://example.com/avatar.png"
      />
    );

    expect(screen.getByText("PF")).toBeInTheDocument();
    expect(screen.getByText("Roadmap")).toBeInTheDocument();
    expect(
      screen.getByText("Platform work and delivery milestones.")
    ).toBeInTheDocument();
    expect(screen.getByText("18 Mar 2026")).toBeInTheDocument();
    expect(screen.getByAltText("Platform")).toBeInTheDocument();
    expect(screen.getByAltText("Author")).toHaveAttribute(
      "src",
      "https://example.com/avatar.png"
    );

    expect(getContrastColor).toHaveBeenCalledWith("#2A4365", 1);
    expect(getContrastColor).toHaveBeenCalledWith("#2A4365", 0.75);
    expect(getContrastColor).toHaveBeenCalledWith("#2A4365", 0.9);
    expect(getContrastColor).toHaveBeenCalledWith("#2A4365", 0.075);
    expect(getContrastColor).toHaveBeenCalledWith("#2A4365", 0.15);
  });

  it("renders the fallback avatar when no author image is provided", () => {
    renderWithProviders(
      <ProjectFolderCard
        color="#2A4365"
        title="No Avatar"
        description="A project without an uploaded author picture."
        icon={<span>NA</span>}
        date="19 Mar 2026"
      />
    );

    expect(screen.queryByAltText("Author")).not.toBeInTheDocument();
    expect(screen.getByText("No Avatar")).toBeInTheDocument();
  });

  it("calls onClick when the card is selected", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderWithProviders(
      <ProjectFolderCard
        color="#2A4365"
        title="Clickable Project"
        description="This card should open project details."
        icon={<span>CP</span>}
        date="20 Mar 2026"
        onClick={onClick}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /clickable project/i })
    );

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
