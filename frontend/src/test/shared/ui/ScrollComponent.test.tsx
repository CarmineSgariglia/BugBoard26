import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScrollComponent } from "@shared/ui/ScrollComponent";

// Mock useFluidWheelContainer
vi.mock("@shared/hooks", () => ({
  useFluidWheelContainer: vi.fn(() => ({ current: null })),
}));

describe("ScrollComponent", () => {
  it("renders children and forwards testId", () => {
    render(
      <ScrollComponent testId="scroll-container">
        <p>Inside text</p>
      </ScrollComponent>
    );

    expect(screen.getByTestId("scroll-container")).toBeInTheDocument();
    expect(screen.getByText("Inside text")).toBeInTheDocument();
  });

  it("applies border class when hideBorder is false", () => {
    const { container } = render(<ScrollComponent hideBorder={false}>Content</ScrollComponent>);
    const div = container.firstChild as HTMLElement;
    expect(div.classList.contains("border")).toBe(true);
  });

  it("removes border class when hideBorder is true", () => {
    const { container } = render(<ScrollComponent hideBorder={true}>Content</ScrollComponent>);
    const div = container.firstChild as HTMLElement;
    expect(div.classList.contains("border")).toBe(false);
  });
});
