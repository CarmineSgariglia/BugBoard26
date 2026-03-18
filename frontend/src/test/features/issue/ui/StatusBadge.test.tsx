import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@features/issue/ui/StatusBadge";
import { renderWithProviders } from "../../../render";

describe("StatusBadge", () => {
  it("renders the text label", () => {
    renderWithProviders(<StatusBadge text="In Progress" color="blue-500" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("always renders the dot indicator", () => {
    const { container } = renderWithProviders(
      <StatusBadge text="Done" color="emerald-500" />
    );
    const dot = container.querySelector(".rounded-full.bg-current");
    expect(dot).toBeInTheDocument();
  });

  it("applies a glow box-shadow when glow=true", () => {
    const { container } = renderWithProviders(
      <StatusBadge text="Done" color="emerald-500" glow />
    );
    const dot = container.querySelector(".rounded-full.bg-current") as HTMLElement;
    expect(dot?.style.boxShadow).toContain("currentColor");
  });

  it("does not apply box-shadow when glow is not set", () => {
    const { container } = renderWithProviders(
      <StatusBadge text="Done" color="emerald-500" />
    );
    const dot = container.querySelector(".rounded-full.bg-current") as HTMLElement;
    expect(dot?.style.boxShadow).toBe("");
  });

  it("renders in default variant without pill classes", () => {
    const { container } = renderWithProviders(
      <StatusBadge text="TODO" color="orange-500" variant="default" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root?.classList.contains("rounded-md")).toBe(false);
  });

  it("renders in pill variant with rounded-md class", () => {
    const { container } = renderWithProviders(
      <StatusBadge text="TODO" color="orange-500" variant="pill" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root?.classList.contains("rounded-md")).toBe(true);
  });
});
