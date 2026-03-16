import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render";
import { AdminUserEditSection } from "./AdminUserEditSection";

const {
  updateUserApiMock,
  adminChangePasswordApiMock,
  adminUploadProfileImageApiMock,
} = vi.hoisted(() => ({
  updateUserApiMock: vi.fn(),
  adminChangePasswordApiMock: vi.fn(),
  adminUploadProfileImageApiMock: vi.fn(),
}));

vi.mock("../../shared/api/modules/users", () => ({
  updateUserApi: updateUserApiMock,
  adminChangePasswordApi: adminChangePasswordApiMock,
  adminUploadProfileImageApi: adminUploadProfileImageApiMock,
}));

function createAxiosFieldError(field: string, message: string) {
  return {
    isAxiosError: true,
    response: {
      data: {
        [field]: [message],
      },
    },
  };
}

describe("AdminUserEditSection", () => {
  const editedUser = {
    userId: 11,
    username: "managed.user",
    email: "managed@example.com",
    firstName: "Managed",
    lastName: "User",
    isAdmin: false,
    profileImg: null,
    active: true,
  };

  beforeEach(() => {
    updateUserApiMock.mockReset();
    adminChangePasswordApiMock.mockReset();
    adminUploadProfileImageApiMock.mockReset();

    adminChangePasswordApiMock.mockResolvedValue(undefined);
    adminUploadProfileImageApiMock.mockResolvedValue(editedUser);
  });

  it("sends the updated username from manage users", async () => {
    const user = userEvent.setup();
    const onUserUpdated = vi.fn();
    updateUserApiMock.mockResolvedValue({
      ...editedUser,
      username: "managed.user.renamed",
    });

    renderWithProviders(
      <AdminUserEditSection user={editedUser} onClose={() => {}} onUserUpdated={onUserUpdated} />
    );

    const usernameInput = screen.getByPlaceholderText("Username");
    await user.clear(usernameInput);
    await user.type(usernameInput, "Managed.User.Renamed");
    expect(usernameInput).toHaveValue("managed.user.renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserApiMock).toHaveBeenCalledWith(11, {
        username: "managed.user.renamed",
        firstName: "Managed",
        lastName: "User",
        email: "managed@example.com",
      });
    });

    await waitFor(() => {
      expect(onUserUpdated).toHaveBeenCalledWith({
        ...editedUser,
        username: "managed.user.renamed",
      });
    });
  });

  it("shows and clears the backend username uniqueness error in manage users", async () => {
    const user = userEvent.setup();
    updateUserApiMock.mockRejectedValue(
      createAxiosFieldError("username", "A user with that username already exists.")
    );

    renderWithProviders(
      <AdminUserEditSection user={editedUser} onClose={() => {}} onUserUpdated={() => {}} />
    );

    const usernameInput = screen.getByPlaceholderText("Username");
    await user.clear(usernameInput);
    await user.type(usernameInput, "Taken-Name");
    expect(usernameInput).toHaveValue("taken-name");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("A user with that username already exists.")).toBeInTheDocument();
    expect(
      screen.queryByText("An error occurred while saving the profile.")
    ).not.toBeInTheDocument();

    await user.type(usernameInput, "2");

    await waitFor(() => {
      expect(screen.queryByText("A user with that username already exists.")).not.toBeInTheDocument();
    });
  });
});
