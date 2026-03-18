import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TitleFieldWithLength } from "@shared/ui/TitleFieldWithLength";

describe("TitleFieldWithLength", () => {
  it("renders with title text length counter", () => {
    render(
      <TitleFieldWithLength 
        label="Title" 
        title="App" 
        onChangeTitle={() => {}} 
        maxLength={20} 
      />
    );
    
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("3 / 20")).toBeInTheDocument();
  });

  it("calls onChangeTitle on typing input", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TitleFieldWithLength label="Title" title="" onChangeTitle={onChange} />);
    
    const input = screen.getByRole("textbox");
    await user.type(input, "B");

    expect(onChange).toHaveBeenCalledWith("B");
  });
});
