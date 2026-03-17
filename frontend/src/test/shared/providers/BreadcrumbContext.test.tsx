import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BreadcrumbProvider, useBreadcrumbs } from "@shared/providers/BreadcrumbContext";

function BreadcrumbProbe() {
  const { labels, setLabel } = useBreadcrumbs();

  return (
    <div>
      <button type="button" onClick={() => setLabel("project", "BugBoard")}>
        Set label
      </button>
      <button type="button" onClick={() => setLabel("project", "BugBoard")}>
        Set same label
      </button>
      <span>{labels.project ?? "missing"}</span>
    </div>
  );
}

describe("BreadcrumbContext", () => {
  it("stores breadcrumb labels through the provider", async () => {
    render(
      <BreadcrumbProvider>
        <BreadcrumbProbe />
      </BreadcrumbProvider>,
    );

    expect(screen.getByText("missing")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByText("BugBoard")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button")[1]);
    expect(screen.getByText("BugBoard")).toBeInTheDocument();
  });

  it("throws when used outside the provider", () => {
    expect(() => render(<BreadcrumbProbe />)).toThrow(
      "useBreadcrumbs must be used within a BreadcrumbProvider",
    );
  });
});
