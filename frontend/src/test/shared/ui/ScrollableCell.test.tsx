import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ScrollableCell } from "@shared/ui/ScrollableCell";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as any;

describe("ScrollableCell", () => {

  it("renders children with action buttons", () => {
    render(<ScrollableCell>Scrolling content</ScrollableCell>);
    
    expect(screen.getByText("Scrolling content")).toBeInTheDocument();
    
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });
});
