import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "@shared/ui/Pagination";

describe("Pagination", () => {
  it("renders item ranges and total properly", () => {
    render(
      <Pagination 
        currentPage={1} 
        totalItems={50} 
        itemsPerPage={10} 
        onPageChange={() => {}} 
      />
    );
    expect(screen.getByText((_, element) => {
      if (element?.tagName !== "SPAN") return false;
      return /Showing[\s\S]*1[\s\S]*10[\s\S]*50/i.test(element.textContent ?? "");
    })).toBeInTheDocument();
  });

  it("calls onPageChange when page numbers clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Pagination 
        currentPage={1} 
        totalItems={30} 
        itemsPerPage={10} 
        onPageChange={onPageChange} 
      />
    );

    const page2Button = screen.getByRole("button", { name: "2" });
    await user.click(page2Button);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables prev button on first page and next on last", () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalItems={20} itemsPerPage={10} onPageChange={() => {}} />
    );
    const buttons = screen.getAllByRole("button");
    const prevButton = buttons[0]; 
    const nextButton = buttons[buttons.length - 1];

    expect(prevButton.hasAttribute("disabled")).toBe(true);
    expect(nextButton.hasAttribute("disabled")).toBe(false);

    rerender(<Pagination currentPage={2} totalItems={20} itemsPerPage={10} onPageChange={() => {}} />);
    
    const updatedButtons = screen.getAllByRole("button");
    expect(updatedButtons[0].hasAttribute("disabled")).toBe(false);
    expect(updatedButtons[updatedButtons.length - 1].hasAttribute("disabled")).toBe(true);
  });
});
