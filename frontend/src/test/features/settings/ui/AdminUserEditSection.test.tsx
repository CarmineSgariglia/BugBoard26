import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../../test/render";
import { AdminUserEditSection } from "@features/settings/ui";

const {
  updateSettingsUserApiMock,
  adminChangeSettingsPasswordApiMock,
  adminUploadSettingsProfileImageApiMock,
  cropProfileImageMock,
} = vi.hoisted(() => ({
  updateSettingsUserApiMock: vi.fn(),
  adminChangeSettingsPasswordApiMock: vi.fn(),
  adminUploadSettingsProfileImageApiMock: vi.fn(),
  cropProfileImageMock: vi.fn(),
}));

vi.mock("@features/settings/api", () => ({
  updateSettingsUserApi: updateSettingsUserApiMock,
  adminChangeSettingsPasswordApi: adminChangeSettingsPasswordApiMock,
  adminUploadSettingsProfileImageApi: adminUploadSettingsProfileImageApiMock,
}));

vi.mock("react-easy-crop", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  function MockCropper({
    onCropComplete,
  }: {
    onCropComplete?: (
      _area: unknown,
      pixels: { x: number; y: number; width: number; height: number }
    ) => void;
  }) {
    React.useEffect(() => {
      onCropComplete?.(
        {},
        {
          x: 0,
          y: 0,
          width: 120,
          height: 120,
        }
      );
    }, [onCropComplete]);

    return <div data-testid="avatar-cropper" />;
  }

  return {
    __esModule: true,
    default: MockCropper,
  };
});

vi.mock("@shared/lib/media", async () => {
  const actual = await vi.importActual<typeof import("@shared/lib/media")>("@shared/lib/media");
  return {
    ...actual,
    cropProfileImage: cropProfileImageMock,
  };
});

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
    updateSettingsUserApiMock.mockReset();
    adminChangeSettingsPasswordApiMock.mockReset();
    adminUploadSettingsProfileImageApiMock.mockReset();
    cropProfileImageMock.mockReset();

    adminChangeSettingsPasswordApiMock.mockResolvedValue(undefined);
    adminUploadSettingsProfileImageApiMock.mockResolvedValue(editedUser);
    cropProfileImageMock.mockImplementation(async (file: File) => file);
  });

  it("sends the updated username from manage users", async () => {
    const user = userEvent.setup();
    const onUserUpdated = vi.fn();
    updateSettingsUserApiMock.mockResolvedValue({
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
      expect(updateSettingsUserApiMock).toHaveBeenCalledWith(11, {
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
    updateSettingsUserApiMock.mockRejectedValue(
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
    expect(screen.queryByText("An error occurred while saving the profile.")).not.toBeInTheDocument();

    await user.type(usernameInput, "2");

    await waitFor(() => {
      expect(screen.queryByText("A user with that username already exists.")).not.toBeInTheDocument();
    });
  });

  it("opens the crop modal and uploads the cropped avatar for managed users", async () => {
    const user = userEvent.setup();
    const onUserUpdated = vi.fn();
    const croppedFile = new File(["cropped"], "avatar-cropped.png", { type: "image/png" });
    cropProfileImageMock.mockResolvedValue(croppedFile);

    renderWithProviders(
      <AdminUserEditSection user={editedUser} onClose={() => {}} onUserUpdated={onUserUpdated} />
    );

    const avatar = screen.getByTitle("Change profile picture");
    const fileInput = avatar.querySelector('input[type="file"]') as HTMLInputElement;
    const originalFile = new File(["original"], "avatar.png", { type: "image/png" });

    await user.upload(fileInput, originalFile);

    expect(await screen.findByText("Adjust profile picture")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply crop" })).not.toHaveAttribute("disabled");
    });
    await user.click(screen.getByRole("button", { name: "Apply crop" }));
    await waitFor(() => {
      expect(screen.queryByText("Adjust profile picture")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(adminUploadSettingsProfileImageApiMock).toHaveBeenCalledWith(11, croppedFile);
    });
  });
});
