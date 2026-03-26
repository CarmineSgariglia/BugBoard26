import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ToastProvider, useToast } from "@shared/providers/ToastProvider";

function ToastHarness() {
  const { pushToast } = useToast();
  const nextNumber = useRef(1);

  return (
    <button
      type="button"
      onClick={() => {
        pushToast({
          title: `Toast ${nextNumber.current++}`,
          description: "Notification arrived",
        });
      }}
    >
      Push toast
    </button>
  );
}

function SuccessToastHarness() {
  const { pushSuccessToast } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        pushSuccessToast("Issue updated successfully.");
      }}
    >
      Push success toast
    </button>
  );
}

describe("ToastProvider", () => {
  it("keeps only the latest three toasts in bottom-up order", async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Push toast" });

    await user.click(trigger);
    await user.click(trigger);
    await user.click(trigger);
    await user.click(trigger);

    const toasts = screen.getAllByRole("status");
    expect(toasts).toHaveLength(3);
    expect(toasts.map((toast) => toast.textContent)).toEqual([
      "Toast 2Notification arrived",
      "Toast 3Notification arrived",
      "Toast 4Notification arrived",
    ]);
  });

  it("allows dismissing a toast manually", async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Push toast" });

    await user.click(trigger);

    expect(screen.getByText("Toast 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss Toast 1" }));

    expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
  });

  it("uses an English default title for success toasts", async () => {
    render(
      <ToastProvider>
        <SuccessToastHarness />
      </ToastProvider>,
    );

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Push success toast" }));

    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Issue updated successfully.")).toBeInTheDocument();
  });
});
