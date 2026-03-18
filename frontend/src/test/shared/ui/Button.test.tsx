import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@shared/ui/Button";

describe("Button", () => {
  it("renders with children and is accessible", () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={onClick}>Click me</Button>);
    
    await user.click(screen.getByRole("button", { name: "Click me" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("prevents clicks and shows spinner when isLoading is true", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button isLoading onClick={onClick}>Click me</Button>);
    
    // Clicking should be blocked or the element disabled
    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // Try clicking just in case, shouldn't fire
    try {
        await user.click(button);
    } catch {}
    expect(onClick).not.toHaveBeenCalled();
  });

  it("prevents clicks when disabled is true", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button disabled onClick={onClick}>Click me</Button>);
    
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button.hasAttribute("disabled")).toBe(true);

    try {
        await user.click(button);
    } catch {}
    
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies fullWidth style by default", () => {
    const { container } = render(<Button>Click me</Button>);
    expect((container.firstChild as HTMLElement).classList.contains("w-full")).toBe(true);
  });

  it("applies variant styles correctly", () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect((container.firstChild as HTMLElement).classList.contains("text-red-500")).toBe(true);
  });
});
