import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarCard } from "@widgets/layout/SidebarCard";
import { renderWithProviders } from "../../render";

describe("SidebarCard", () => {
  it("renders its children and applies custom classes", () => {
    const { container } = renderWithProviders(
      <SidebarCard className="custom-sidebar">
        <div>Sidebar content</div>
      </SidebarCard>
    );

    expect(screen.getByText("Sidebar content")).toBeInTheDocument();
    expect(container.querySelector(".custom-sidebar")).toBeInTheDocument();
  });

  it("renders section title and section content", () => {
    renderWithProviders(
      <SidebarCard.Section title="Members">
        <div>Section body</div>
      </SidebarCard.Section>
    );

    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Section body")).toBeInTheDocument();
  });
});
