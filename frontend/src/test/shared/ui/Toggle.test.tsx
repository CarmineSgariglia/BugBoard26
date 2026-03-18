import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { Toggle } from "../../../shared/ui/Toggle";

describe("Toggle", () => {
  it("renders an accessible switch with the provided label", () => {
    render(<Toggle checked={false} onChange={() => {}} label="Dark mode" />);

    const toggle = screen.getByRole("switch", { name: "Dark mode" });

    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the inverted value when clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<Toggle checked={false} onChange={onChange} label="Notifications" />);

    await user.click(screen.getByRole("switch", { name: "Notifications" }));

    expect(onChange).toHaveBeenCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not call onChange when disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<Toggle checked={true} onChange={onChange} label="Email alerts" disabled />);

    await user.click(screen.getByRole("switch", { name: "Email alerts" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
