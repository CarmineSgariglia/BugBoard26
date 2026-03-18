import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangePasswordSection } from "@features/settings/ui/ChangePasswordSection";
import { renderWithProviders } from "../../../render";

describe("ChangePasswordSection", () => {
  const defaultProps = {
    requireCurrentPassword: true,
    currentPassword: "",
    onChangeCurrentPassword: vi.fn(),
    newPassword: "",
    onChangeNewPassword: vi.fn(),
    onRetrievePassword: vi.fn(),
  };

  it("renders the title", () => {
    renderWithProviders(<ChangePasswordSection {...defaultProps} />);
    expect(screen.getByText("Change Password")).toBeInTheDocument();
  });

  it("shows current password field when requireCurrentPassword is true", () => {
    renderWithProviders(<ChangePasswordSection {...defaultProps} />);
    expect(screen.getByText("Current Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter current password")).toBeInTheDocument();
  });

  it("hides current password field when requireCurrentPassword is false", () => {
    renderWithProviders(
      <ChangePasswordSection {...defaultProps} requireCurrentPassword={false} />
    );
    expect(screen.queryByText("Current Password")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter current password")).not.toBeInTheDocument();
  });

  it("always shows new password field", () => {
    renderWithProviders(<ChangePasswordSection {...defaultProps} />);
    expect(screen.getByText("New Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter new password")).toBeInTheDocument();
  });

  it("calls onChangeCurrentPassword when typing in current password field", async () => {
    const onChangeCurrentPassword = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ChangePasswordSection
        {...defaultProps}
        onChangeCurrentPassword={onChangeCurrentPassword}
      />
    );

    const input = screen.getByPlaceholderText("Enter current password");
    await user.type(input, "a");
    expect(onChangeCurrentPassword).toHaveBeenCalledWith("a");
  });

  it("calls onChangeNewPassword when typing in new password field", async () => {
    const onChangeNewPassword = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ChangePasswordSection
        {...defaultProps}
        onChangeNewPassword={onChangeNewPassword}
      />
    );

    const input = screen.getByPlaceholderText("Enter new password");
    await user.type(input, "x");
    expect(onChangeNewPassword).toHaveBeenCalledWith("x");
  });

  it("calls onRetrievePassword when clicking the retrieve password button", async () => {
    const onRetrievePassword = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ChangePasswordSection {...defaultProps} onRetrievePassword={onRetrievePassword} />
    );

    await user.click(screen.getByText("RETRIEVE PASSWORD"));
    expect(onRetrievePassword).toHaveBeenCalledTimes(1);
  });

  it("shows error message when error prop is provided", () => {
    renderWithProviders(
      <ChangePasswordSection {...defaultProps} error="Password is too short" />
    );
    expect(screen.getByText("Password is too short")).toBeInTheDocument();
  });

  it("does not show error message when error prop is not provided", () => {
    renderWithProviders(<ChangePasswordSection {...defaultProps} />);
    expect(screen.queryByText("Password is too short")).not.toBeInTheDocument();
  });

  it("displays the provided currentPassword value", () => {
    renderWithProviders(
      <ChangePasswordSection {...defaultProps} currentPassword="secret123" />
    );
    expect(screen.getByPlaceholderText("Enter current password")).toHaveValue("secret123");
  });

  it("displays the provided newPassword value", () => {
    renderWithProviders(
      <ChangePasswordSection {...defaultProps} newPassword="newSecret" />
    );
    expect(screen.getByPlaceholderText("Enter new password")).toHaveValue("newSecret");
  });
});
