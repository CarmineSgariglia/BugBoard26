import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToggleUserStatusModal } from "@features/settings/ui/ToggleUserStatusModal";
import { renderWithProviders } from "../../../render";
import type { AuthUser } from "@shared/api/types/auth";

const activeUser: AuthUser = {
  userId: 1,
  username: "mrossi",
  email: "mario.rossi@example.com",
  firstName: "Mario",
  lastName: "Rossi",
  active: true,
};

const inactiveUser: AuthUser = {
  userId: 2,
  username: "lverdi",
  email: "luigi.verdi@example.com",
  firstName: "Luigi",
  lastName: "Verdi",
  active: false,
};

const activeSuperuser: AuthUser = {
  userId: 99,
  username: "root",
  email: "root@example.com",
  firstName: "Root",
  lastName: "Admin",
  active: true,
  isSuperuser: true,
};

describe("ToggleUserStatusModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("renders nothing when user is null", () => {
    renderWithProviders(
      <ToggleUserStatusModal {...defaultProps} user={null} />
    );
    expect(screen.queryByText("Deactivate User")).not.toBeInTheDocument();
    expect(screen.queryByText("Activate User")).not.toBeInTheDocument();
  });

  it("shows deactivate dialog for an active user", () => {
    renderWithProviders(
      <ToggleUserStatusModal {...defaultProps} user={activeUser} />
    );
    expect(screen.getByText("Deactivate User")).toBeInTheDocument();
    expect(screen.getByText("Deactivate")).toBeInTheDocument();
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(
      screen.getByText(/The user will no longer be able to access the system/)
    ).toBeInTheDocument();
  });

  it("shows activate dialog for an inactive user", () => {
    renderWithProviders(
      <ToggleUserStatusModal {...defaultProps} user={inactiveUser} />
    );
    expect(screen.getByText("Activate User")).toBeInTheDocument();
    expect(screen.getByText("Activate")).toBeInTheDocument();
    expect(screen.getByText("Luigi Verdi")).toBeInTheDocument();
    expect(
      screen.getByText(/The user will regain access to the system/)
    ).toBeInTheDocument();
  });

  it("falls back to username when firstName and lastName are missing", () => {
    const userNoName: AuthUser = {
      userId: 3,
      username: "anonimo",
      email: "anon@example.com",
      active: true,
    };
    renderWithProviders(
      <ToggleUserStatusModal {...defaultProps} user={userNoName} />
    );
    expect(screen.getByText("anonimo")).toBeInTheDocument();
  });

  it("treats user as active when active is undefined", () => {
    const userNoActive: AuthUser = {
      userId: 4,
      username: "test",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    };
    renderWithProviders(
      <ToggleUserStatusModal {...defaultProps} user={userNoActive} />
    );
    expect(screen.getByText("Deactivate User")).toBeInTheDocument();
  });

  it("does not render for an active superuser", () => {
    renderWithProviders(
      <ToggleUserStatusModal {...defaultProps} user={activeSuperuser} />
    );
    expect(screen.queryByText("Deactivate User")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ToggleUserStatusModal
        {...defaultProps}
        user={activeUser}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByText("Deactivate"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel/close is triggered", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ToggleUserStatusModal
        {...defaultProps}
        user={activeUser}
        onClose={onClose}
      />
    );

    const cancelBtn = screen.getByText("Cancel");
    await user.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when isOpen is false", () => {
    renderWithProviders(
      <ToggleUserStatusModal
        {...defaultProps}
        isOpen={false}
        user={activeUser}
      />
    );
    expect(screen.queryByText("Deactivate User")).not.toBeInTheDocument();
  });
});
