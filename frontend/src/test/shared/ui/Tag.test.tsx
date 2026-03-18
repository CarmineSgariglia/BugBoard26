import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tag } from "@shared/ui/Tag";

describe("Tag", () => {
  it("renders with text and default styling", () => {
    render(<Tag text="Test Tag" />);
    
    const tag = screen.getByText("Test Tag");
    expect(tag).toBeInTheDocument();
    expect(tag.className).toContain("text-[#4A72FF]");
  });

  it("applies custom styles via props", () => {
    render(<Tag text="Custom" textColor="text-red-500" borderColor="border-red-200" />);
    
    const tag = screen.getByText("Custom");
    expect(tag.className).toContain("text-red-500");
    expect(tag.className).toContain("border-red-200");
  });
});
