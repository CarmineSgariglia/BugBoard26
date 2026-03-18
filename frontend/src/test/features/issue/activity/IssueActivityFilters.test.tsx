import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IssueActivityFilters } from "@features/issue/activity/IssueActivityFilters";
import { renderWithProviders } from "../../../render";

describe("IssueActivityFilters", () => {
  const defaultProps = {
    scope: "ALL" as const,
    sort: "NEWEST" as const,
    onScopeChange: vi.fn(),
    onSortChange: vi.fn(),
  };

  it("renders the scope select with current value", () => {
    renderWithProviders(<IssueActivityFilters {...defaultProps} />);
    // The Select component renders a native <select>
    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("ALL");
  });

  it("renders the sort select with current value", () => {
    renderWithProviders(<IssueActivityFilters {...defaultProps} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects[1]).toHaveValue("NEWEST");
  });

  it("reflects YOURS scope value", () => {
    renderWithProviders(
      <IssueActivityFilters {...defaultProps} scope="YOURS" />
    );
    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("YOURS");
  });

  it("reflects OLDEST sort value", () => {
    renderWithProviders(
      <IssueActivityFilters {...defaultProps} sort="OLDEST" />
    );
    const selects = screen.getAllByRole("combobox");
    expect(selects[1]).toHaveValue("OLDEST");
  });

  it("calls onScopeChange with YOURS when selected", async () => {
    const onScopeChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <IssueActivityFilters {...defaultProps} onScopeChange={onScopeChange} />
    );
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "YOURS");
    expect(onScopeChange).toHaveBeenCalledWith("YOURS");
  });

  it("calls onSortChange with OLDEST when selected", async () => {
    const onSortChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <IssueActivityFilters {...defaultProps} onSortChange={onSortChange} />
    );
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "OLDEST");
    expect(onSortChange).toHaveBeenCalledWith("OLDEST");
  });

  it("renders All and Yours as scope options", () => {
    renderWithProviders(<IssueActivityFilters {...defaultProps} />);
    expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Yours" })).toBeInTheDocument();
  });

  it("renders Newest first and Oldest first as sort options", () => {
    renderWithProviders(<IssueActivityFilters {...defaultProps} />);
    expect(
      screen.getByRole("option", { name: "Newest first" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Oldest first" })
    ).toBeInTheDocument();
  });
});
