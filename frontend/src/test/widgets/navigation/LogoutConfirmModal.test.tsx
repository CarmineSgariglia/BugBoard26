import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogoutConfirmModal } from "@widgets/navigation/LogoutConfirmModal";
import { renderWithProviders } from "../../render";

vi.mock("@shared/ui/ConfirmModal", () => ({
  ConfirmModal: ({
    isOpen,
    title,
    confirmText,
    onConfirm,
    onClose,
  }: {
    isOpen: boolean;
    title: string;
    confirmText: string;
    onConfirm: () => void;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>{title}</span>
        <button onClick={onConfirm}>{confirmText}</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

describe("LogoutConfirmModal", () => {
  it("forwards the logout confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(
      <LogoutConfirmModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} />
    );

    expect(screen.getByText("Sign Out")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
