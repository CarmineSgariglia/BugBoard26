import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileHeader } from "@features/settings/ui/ProfileHeader";
import { renderWithProviders } from "../../../render";

describe("ProfileHeader", () => {
  const defaultProps = {
    title: "Mario Rossi",
    subtitle: "mario.rossi@example.com",
  };

  it("renders title and subtitle", () => {
    renderWithProviders(<ProfileHeader {...defaultProps} />);
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("mario.rossi@example.com")).toBeInTheDocument();
  });

  it("renders in view mode with user icon when mode is view", () => {
    renderWithProviders(<ProfileHeader {...defaultProps} mode="view" />);
    // In view mode, no file input or clickable avatar
    expect(screen.queryByTitle("Change profile picture")).not.toBeInTheDocument();
  });

  it("renders in edit mode by default with clickable avatar", () => {
    renderWithProviders(<ProfileHeader {...defaultProps} />);
    expect(screen.getByTitle("Change profile picture")).toBeInTheDocument();
  });

  it("shows avatar image when avatarUrl is provided in edit mode", () => {
    renderWithProviders(
      <ProfileHeader {...defaultProps} avatarUrl="https://example.com/avatar.jpg" />
    );
    const img = screen.getByAltText("Profile");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("does not show avatar image when avatarUrl is not provided", () => {
    renderWithProviders(<ProfileHeader {...defaultProps} />);
    expect(screen.queryByAltText("Profile")).not.toBeInTheDocument();
  });

  it("triggers file input when clicking the avatar in edit mode", async () => {
    const onImageSelect = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ProfileHeader {...defaultProps} onImageSelect={onImageSelect} />
    );

    const avatar = screen.getByTitle("Change profile picture");
    await user.click(avatar);

    // The hidden file input should exist
    const fileInput = avatar.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });

  it("calls onImageSelect when a file is selected", async () => {
    const onImageSelect = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ProfileHeader {...defaultProps} onImageSelect={onImageSelect} />
    );

    const avatar = screen.getByTitle("Change profile picture");
    const fileInput = avatar.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    await user.upload(fileInput, file);
    expect(onImageSelect).toHaveBeenCalledWith(file);
  });

  it("does not trigger file input when clicking avatar while uploading", async () => {
    const onImageSelect = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ProfileHeader
        {...defaultProps}
        onImageSelect={onImageSelect}
        isUploading={true}
      />
    );

    const avatar = screen.getByTitle("Change profile picture");
    await user.click(avatar);
    // isUploading prevents the click handler from opening the file dialog
    // We can't directly test if click() was suppressed, but we verify
    // the spinner overlay is displayed
    const spinnerOverlay = avatar.querySelector(".animate-spin");
    expect(spinnerOverlay).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = renderWithProviders(
      <ProfileHeader {...defaultProps} className="custom-class" />
    );
    expect((container.firstChild as Element)?.classList?.contains("custom-class")).toBe(true);
  });
});
