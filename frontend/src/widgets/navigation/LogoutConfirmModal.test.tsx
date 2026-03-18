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
  it("clears the query cache and forwards the logout confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { queryClient } = renderWithProviders(
      <LogoutConfirmModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} />
    );
    const clearSpy = vi.spyOn(queryClient, "clear");

    expect(screen.getByText("Sign Out")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
