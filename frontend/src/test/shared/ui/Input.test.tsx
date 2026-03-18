import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "@shared/ui/Input";

describe("Input", () => {
  it("renders with placeholder and forwards props", () => {
    render(<Input placeholder="Enter text" name="test-input" />);
    
    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("name", "test-input");
  });

  it("toggles password visibility when clicking eye icon", async () => {
    const user = userEvent.setup();
    render(<Input type="password" placeholder="Password" />);
    
    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button");
    expect(toggleButton).toBeInTheDocument();

    await user.click(toggleButton);
    expect(input).toHaveAttribute("type", "text");

    await user.click(toggleButton);
    expect(input).toHaveAttribute("type", "password");
  });

  it("applies error styles when hasError is true", () => {
    render(<Input hasError placeholder="Error" />);
    const input = screen.getByPlaceholderText("Error");
    
    expect(input.className).toContain("border-rose-500");
  });
});
