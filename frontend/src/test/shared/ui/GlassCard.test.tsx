import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlassCard } from "@shared/ui/GlassCard";

describe("GlassCard", () => {
  it("renders children correctly", () => {
    render(
      <GlassCard>
        <div data-testid="child">Content</div>
      </GlassCard>
    );
    
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies custom className merge", () => {
    const { container } = render(
      <GlassCard className="custom-class">
        <div>Content</div>
      </GlassCard>
    );
    
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("custom-class");
    expect(div.className).toContain("backdrop-blur-xl");
  });
});
