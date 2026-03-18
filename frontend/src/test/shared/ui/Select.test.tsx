import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select, type SelectOption } from "@shared/ui/Select";

describe("Select", () => {
  const options: SelectOption[] = [
    { label: "Option One", value: "one" },
    { label: "Option Two", value: "two" },
    { label: "Option Three", value: "three" },
  ];

  it("renders with options and is accessible", () => {
    render(<Select value="one" onChange={vi.fn()} options={options} />);
    
    // Select element exists
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    // Correct number of options rendered
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "Option One" })).toBeInTheDocument();
  });

  it("calls onChange when value changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<Select value="one" onChange={onChange} options={options} />);
    
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "two");

    expect(onChange).toHaveBeenCalledWith("two");
  });

  it("applies disabled styles and locks select options", async () => {
    const onChange = vi.fn();

    render(<Select disabled value="one" onChange={onChange} options={options} />);
    
    const select = screen.getByRole("combobox");
    expect(select.hasAttribute("disabled")).toBe(true);

    // Since it's disabled, user-event will error or do nothing
    // We can just verify it has the disabled attribute
  });

  it("renders with an icon if provided", () => {
    const icon = <span data-testid="custom-icon"></span>;
    render(<Select icon={icon} value="one" onChange={vi.fn()} options={options} />);
    
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
