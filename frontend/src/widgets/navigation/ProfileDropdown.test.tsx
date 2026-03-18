import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ProfileDropdown } from "@widgets/navigation/ProfileDropdown";
import { renderWithProviders } from "../../render";

describe("ProfileDropdown", () => {
  it("does not render when closed", () => {
    renderWithProviders(
      <ProfileDropdown isOpen={false} onClose={vi.fn()} onLogout={vi.fn()} />
    );

    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("closes on backdrop click and navigates to settings", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <Routes>
        <Route
          path="/projects"
          element={
            <div>
              <ProfileDropdown isOpen={true} onClose={onClose} onLogout={vi.fn()} />
            </div>
          }
        />
        <Route path="/settings" element={<div>Settings page</div>} />
      </Routes>,
      { route: "/projects" }
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();

    const backdrop = container.querySelector(".fixed.inset-0") as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /settings/i }));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Settings page")).toBeInTheDocument();
  });

  it("calls onLogout when the logout action is pressed", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    renderWithProviders(
      <Routes>
        <Route
          path="/projects"
          element={
            <ProfileDropdown isOpen={true} onClose={vi.fn()} onLogout={onLogout} />
          }
        />
      </Routes>,
      { route: "/projects" }
    );

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
