import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateProjectCard } from "@features/project/ui/CreateProjectCard";
import { renderWithProviders } from "../../../render";

describe("CreateProjectCard", () => {
  it("renders the create project call to action", () => {
    renderWithProviders(<CreateProjectCard onClick={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /create project/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Create Project")).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderWithProviders(<CreateProjectCard onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
