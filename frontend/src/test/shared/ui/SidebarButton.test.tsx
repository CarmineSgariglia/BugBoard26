import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarButton } from "@shared/ui/SidebarButton";

describe("SidebarButton", () => {
  it("renders with icon and label", () => {
    render(<SidebarButton icon={<span data-testid="icon">🔍</span>} label="Search" />);
    
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<SidebarButton icon={<div>Icon</div>} label="Dash" onClick={onClick} />);
    
    const button = screen.getByRole("button");
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies danger variant classes to button", () => {
    const { container } = render(
      <SidebarButton icon={<div>Icon</div>} label="Delete" variant="danger" />
    );
    
    const button = container.firstChild as HTMLElement;
    expect(button.className).toContain("hover:text-red-400");
  });
});
