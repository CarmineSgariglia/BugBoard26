import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchBar } from "@shared/ui/SearchBar";

describe("SearchBar", () => {
  it("renders with default placeholder and value", () => {
    render(<SearchBar value="Test" onChange={() => {}} />);
    
    const input = screen.getByDisplayValue("Test");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Search...");
  });

  it("calls onChange with new string when typing", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar value="" onChange={onChange} />);
    
    const input = screen.getByRole("textbox");
    await user.type(input, "Hello");

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith("o");
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it("applies custom background and text color classes", () => {
    const { container } = render(
      <SearchBar value="" onChange={() => {}} bgColor="bg-red-500" textColor="text-white" />
    );
    
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("bg-red-500");
    
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("text-white");
  });
});
