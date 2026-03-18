import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "@shared/ui/Avatar";

// Mock resolveMediaUrl
vi.mock("@shared/api/core/media", () => ({
  resolveMediaUrl: vi.fn((url) => `${url}-resolved`),
}));

describe("Avatar", () => {
  it("renders image when src is provided", () => {
    render(<Avatar name="John Doe" src="/path/to/img.png" />);
    
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/path/to/img.png-resolved");
    expect(img).toHaveAttribute("alt", "John Doe");
  });

  it("renders initial fallback when src is missing", () => {
    render(<Avatar name="John Doe" />);
    
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("applies correct size classes", () => {
    const { container } = render(<Avatar name="John" size="sm" />);
    const div = container.firstChild as HTMLElement;
    
    expect(div.className).toContain("w-8 h-8");
  });
});
