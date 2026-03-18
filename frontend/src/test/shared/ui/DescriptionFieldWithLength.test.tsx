import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DescriptionFieldWithLength } from "@shared/ui/DescriptionFieldWithLength";

describe("DescriptionFieldWithLength", () => {
  it("renders label and character counter", () => {
    render(
      <DescriptionFieldWithLength 
        label="Description" 
        description="Hello" 
        onChangeDescription={() => {}} 
        maxLength={100} 
      />
    );
    
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("5 / 100")).toBeInTheDocument();
  });

  it("calls onChangeDescription when typing", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <DescriptionFieldWithLength 
        label="Description" 
        description="" 
        onChangeDescription={onChange} 
      />
    );
    
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "A");

    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("applies max length to textarea component", () => {
    render(
      <DescriptionFieldWithLength 
        label="Description" 
        description="" 
        onChangeDescription={() => {}} 
        maxLength={50} 
      />
    );
    
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("maxLength", "50");
  });
});
