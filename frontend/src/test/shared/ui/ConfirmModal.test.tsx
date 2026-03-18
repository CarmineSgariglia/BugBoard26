import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmModal } from "@shared/ui/ConfirmModal";

describe("ConfirmModal", () => {
  const getDefaultProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Are you sure?",
    description: "This action cannot be undone.",
    icon: <span data-testid="test-icon"></span>,
    confirmText: "Confirm",
  });

  it("renders into document.body with createPortal when isOpen is true", () => {
    render(<ConfirmModal {...getDefaultProps()} />);
    
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<ConfirmModal {...getDefaultProps()} isOpen={false} />);
    
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();

    render(<ConfirmModal {...getDefaultProps()} onConfirm={onConfirm} />);
    
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();

    render(<ConfirmModal {...getDefaultProps()} onClose={onClose} />);
    
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();

    const { container } = render(<ConfirmModal {...getDefaultProps()} onClose={onClose} />);
    
    // Backdrop is usually the first child above the Card
    const backdrop = container.ownerDocument.querySelector(".bg-black\\/60");
    expect(backdrop).toBeInTheDocument();

    if (backdrop) {
       fireEvent.click(backdrop);
       expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it("prevents interactions and displays loading spinner when isLoading is true", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(<ConfirmModal {...getDefaultProps()} isLoading={true} onConfirm={onConfirm} />);
    
    const confirmButton = screen.getByRole("button", { name: "Loading..." });
    expect(confirmButton.hasAttribute("disabled")).toBe(true); // Button disabled state mapped to isLoading

    try {
        await user.click(confirmButton);
    } catch {}
    
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
