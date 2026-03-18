import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagInput } from "@shared/ui/TagInput";

describe("TagInput", () => {
  it("renders existing tags and remove button", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TagInput tags={["Bug", "Feature"]} onChange={onChange} />);

    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button");
    await user.click(removeButtons[0]);
    
    expect(onChange).toHaveBeenCalledWith(["Feature"]);
  });

  it("calls onChange adding tag on Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TagInput tags={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText("Add tag...");
    await user.type(input, "Enhancement{Enter}");

    expect(onChange).toHaveBeenCalledWith(["Enhancement"]);
  });

  it("hides input and respects maxTags constraint", () => {
    render(<TagInput tags={["1", "2"]} onChange={() => {}} maxTags={2} />);

    expect(screen.queryByPlaceholderText("Add tag...")).not.toBeInTheDocument();
    expect(screen.getByText("MAX 2")).toBeInTheDocument();
  });
});
