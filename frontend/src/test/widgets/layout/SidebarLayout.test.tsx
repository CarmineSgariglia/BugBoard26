import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarLayout } from "@widgets/layout/SidebarLayout";
import { renderWithProviders } from "../../render";

describe("SidebarLayout", () => {
  it("renders header, main content and sidebar content", () => {
    const { container } = renderWithProviders(
      <SidebarLayout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        className="layout-shell"
        gridClassName="grid-custom"
      >
        <div>Main content</div>
      </SidebarLayout>
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Main content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(container.querySelector(".layout-shell")).toBeInTheDocument();
    expect(container.querySelector(".grid-custom")).toBeInTheDocument();
  });
});
