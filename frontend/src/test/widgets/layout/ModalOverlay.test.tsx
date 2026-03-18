import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalOverlay } from "@widgets/layout/ModalOverlay";
import { useLockBodyScroll } from "@shared/hooks/useLockBodyScroll";
import { renderWithProviders } from "../../render";

vi.mock("@shared/hooks/useLockBodyScroll", () => ({
  useLockBodyScroll: vi.fn(),
}));

describe("ModalOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when closed and still wires the body-scroll hook", () => {
    renderWithProviders(
      <ModalOverlay isOpen={false} onClose={vi.fn()}>
        <div>Overlay content</div>
      </ModalOverlay>
    );

    expect(screen.queryByText("Overlay content")).not.toBeInTheDocument();
    expect(useLockBodyScroll).toHaveBeenCalledWith(false);
  });

  it("renders its content in a portal and closes on backdrop click", () => {
    const onClose = vi.fn();

    renderWithProviders(
      <ModalOverlay
        isOpen={true}
        onClose={onClose}
        maxWidth="max-w-xl"
        className="custom-modal"
      >
        <div>Overlay content</div>
      </ModalOverlay>
    );

    expect(screen.getByText("Overlay content")).toBeInTheDocument();
    expect(useLockBodyScroll).toHaveBeenCalledWith(true);

    const modal = document.body.querySelector(".custom-modal") as HTMLElement;
    expect(modal).toBeInTheDocument();
    expect(modal.className).toContain("max-w-xl");

    const backdrop = document.body.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
