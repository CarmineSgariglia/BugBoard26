import { describe, expect, it } from "vitest";

import { useLockBodyScroll } from "@shared/hooks/useLockBodyScroll";
import { renderWithProviders } from "../../render";

function HookProbe({ isLocked }: { isLocked: boolean }) {
  useLockBodyScroll(isLocked);
  return <div>probe</div>;
}

describe("useLockBodyScroll", () => {
  it("locks the body scroll and restores the previous value on unmount", () => {
    document.body.style.overflow = "auto";

    const { unmount } = renderWithProviders(<HookProbe isLocked={true} />);

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("auto");
  });

  it("does not change the body overflow when the lock is disabled", () => {
    document.body.style.overflow = "scroll";

    renderWithProviders(<HookProbe isLocked={false} />);

    expect(document.body.style.overflow).toBe("scroll");
  });

  it("applies the lock when the flag changes from false to true", () => {
    document.body.style.overflow = "visible";

    const { rerender } = renderWithProviders(<HookProbe isLocked={false} />);

    expect(document.body.style.overflow).toBe("visible");

    rerender(<HookProbe isLocked={true} />);

    expect(document.body.style.overflow).toBe("hidden");
  });
});
