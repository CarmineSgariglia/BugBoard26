import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrioritySelector } from "@features/issue/ui/PrioritySelector";
import { renderWithProviders } from "../../../render";

const PRIORITY_LABELS = ["Low", "Medium", "High", "Urgent"];

describe("PrioritySelector", () => {
  it("renders all four priority buttons", () => {
    renderWithProviders(<PrioritySelector value="LOW" onChange={vi.fn()} />);
    for (const label of PRIORITY_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("renders the Priority label", () => {
    renderWithProviders(<PrioritySelector value="LOW" onChange={vi.fn()} />);
    expect(screen.getByText("Priority")).toBeInTheDocument();
  });

  it("calls onChange with LOW when Low button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PrioritySelector value="MEDIUM" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Low" }));
    expect(onChange).toHaveBeenCalledWith("LOW");
  });

  it("calls onChange with MEDIUM when Medium button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PrioritySelector value="LOW" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Medium" }));
    expect(onChange).toHaveBeenCalledWith("MEDIUM");
  });

  it("calls onChange with HIGH when High button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PrioritySelector value="LOW" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "High" }));
    expect(onChange).toHaveBeenCalledWith("HIGH");
  });

  it("calls onChange with URGENT when Urgent button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PrioritySelector value="LOW" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Urgent" }));
    expect(onChange).toHaveBeenCalledWith("URGENT");
  });

  it("highlights the active button with a text-white class", () => {
    renderWithProviders(<PrioritySelector value="HIGH" onChange={vi.fn()} />);
    const highBtn = screen.getByRole("button", { name: "High" });
    expect(highBtn.classList.contains("text-white")).toBe(true);
  });

  it("does not highlight inactive buttons with text-white", () => {
    renderWithProviders(<PrioritySelector value="HIGH" onChange={vi.fn()} />);
    const lowBtn = screen.getByRole("button", { name: "Low" });
    expect(lowBtn.classList.contains("text-white")).toBe(false);
  });
});
