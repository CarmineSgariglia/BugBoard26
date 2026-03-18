import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "@shared/ui/Textarea";

describe("Textarea", () => {
  it("renders generic attribute and combines classNames", () => {
    render(<Textarea placeholder="Write text" name="notes" className="custom-area" />);
    
    const textarea = screen.getByPlaceholderText("Write text");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("name", "notes");
    expect(textarea.className).toContain("custom-area");
  });

  it("applies hasError styles", () => {
    render(<Textarea hasError placeholder="Error" />);
    
    const textarea = screen.getByPlaceholderText("Error");
    expect(textarea.className).toContain("border-rose-500");
  });
});
