import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../../test/render";
import { ProfileSettingsSection } from "@features/settings/ui";

const {
  useAuthMock,
  updateSettingsUserApiMock,
  changeSettingsPasswordApiMock,
  uploadSettingsProfileImageApiMock,
  handleGetHelpMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  updateSettingsUserApiMock: vi.fn(),
  changeSettingsPasswordApiMock: vi.fn(),
  uploadSettingsProfileImageApiMock: vi.fn(),
  handleGetHelpMock: vi.fn(),
}));

vi.mock("@features/auth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@features/settings/api", () => ({
  updateSettingsUserApi: updateSettingsUserApiMock,
  changeSettingsPasswordApi: changeSettingsPasswordApiMock,
  uploadSettingsProfileImageApi: uploadSettingsProfileImageApiMock,
}));

vi.mock("@shared/lib/help", () => ({
  handleGetHelp: handleGetHelpMock,
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

describe("ProfileSettingsSection", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    updateSettingsUserApiMock.mockReset();
    changeSettingsPasswordApiMock.mockReset();
    uploadSettingsProfileImageApiMock.mockReset();
    handleGetHelpMock.mockReset();

    useAuthMock.mockReturnValue({
      user: {
        userId: 7,
        username: "dev",
        email: "dev@example.com",
        firstName: "Mario",
        lastName: "Rossi",
        profileImg: null,
      },
      refreshUser: vi.fn().mockResolvedValue(undefined),
    });

    changeSettingsPasswordApiMock.mockResolvedValue(undefined);
    uploadSettingsProfileImageApiMock.mockResolvedValue({
      userId: 7,
      username: "dev",
      email: "dev@example.com",
      firstName: "Mario",
      lastName: "Rossi",
      profileImg: null,
    });
  });

  it("sends the updated username in profile settings", async () => {
    const user = userEvent.setup();
    updateSettingsUserApiMock.mockResolvedValue({
      userId: 7,
      username: "dev.renamed",
      email: "dev@example.com",
      firstName: "Mario",
      lastName: "Rossi",
      profileImg: null,
    });

    renderWithProviders(<ProfileSettingsSection />);

    const usernameInput = screen.getByPlaceholderText("Username");
    await user.clear(usernameInput);
    await user.type(usernameInput, "Dev.Renamed");
    expect(usernameInput).toHaveValue("dev.renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateSettingsUserApiMock).toHaveBeenCalledWith(7, {
        username: "dev.renamed",
        firstName: "Mario",
        lastName: "Rossi",
        email: "dev@example.com",
      });
    });
  });

  it("shows and clears the backend username uniqueness error", async () => {
    const user = userEvent.setup();
    updateSettingsUserApiMock.mockRejectedValue(
      createAxiosFieldError("username", "A user with that username already exists.")
    );

    renderWithProviders(<ProfileSettingsSection />);

    const usernameInput = screen.getByPlaceholderText("Username");
    await user.clear(usernameInput);
    await user.type(usernameInput, "Taken-Name");
    expect(usernameInput).toHaveValue("taken-name");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("A user with that username already exists.")).toBeInTheDocument();
    expect(screen.queryByText("An error occurred while saving the profile.")).not.toBeInTheDocument();

    await user.type(usernameInput, "2");

    await waitFor(() => {
      expect(screen.queryByText("A user with that username already exists.")).not.toBeInTheDocument();
    });
  });
});
