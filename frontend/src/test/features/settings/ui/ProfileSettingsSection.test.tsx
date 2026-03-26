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
  cropProfileImageMock,
  resolveMediaUrlMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  updateSettingsUserApiMock: vi.fn(),
  changeSettingsPasswordApiMock: vi.fn(),
  uploadSettingsProfileImageApiMock: vi.fn(),
  handleGetHelpMock: vi.fn(),
  cropProfileImageMock: vi.fn(),
  resolveMediaUrlMock: vi.fn((value?: string) => `resolved:${value ?? ""}`),
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

vi.mock("@shared/api/core/media", () => ({
  resolveMediaUrl: resolveMediaUrlMock,
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

describe("ProfileSettingsSection", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    updateSettingsUserApiMock.mockReset();
    changeSettingsPasswordApiMock.mockReset();
    uploadSettingsProfileImageApiMock.mockReset();
    handleGetHelpMock.mockReset();
    cropProfileImageMock.mockReset();
    resolveMediaUrlMock.mockClear();

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
    cropProfileImageMock.mockImplementation(async (file: File) => file);
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
    expect(await screen.findByText("Profilo modificato con successo.")).toBeInTheDocument();
  });

  it("renders the current profile image when the authenticated user already has one", () => {
    useAuthMock.mockReturnValue({
      user: {
        userId: 7,
        username: "dev",
        email: "dev@example.com",
        firstName: "Mario",
        lastName: "Rossi",
        profileImg: "/media/existing-avatar.png",
      },
      refreshUser: vi.fn().mockResolvedValue(undefined),
    });

    renderWithProviders(<ProfileSettingsSection />);

    expect(resolveMediaUrlMock).toHaveBeenCalledWith("/media/existing-avatar.png");
    expect(screen.getByAltText("Profile")).toHaveAttribute(
      "src",
      "resolved:/media/existing-avatar.png"
    );
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

  it("opens the crop modal and uploads the cropped avatar file", async () => {
    const user = userEvent.setup();
    const croppedFile = new File(["cropped"], "avatar-cropped.png", { type: "image/png" });
    uploadSettingsProfileImageApiMock.mockResolvedValue({
      userId: 7,
      username: "dev",
      email: "dev@example.com",
      firstName: "Mario",
      lastName: "Rossi",
      profileImg: "/media/uploaded-avatar.png",
    });
    cropProfileImageMock.mockResolvedValue(croppedFile);

    renderWithProviders(<ProfileSettingsSection />);

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
      expect(uploadSettingsProfileImageApiMock).toHaveBeenCalledWith(croppedFile);
    });

    await waitFor(() => {
      expect(screen.getByAltText("Profile")).toHaveAttribute(
        "src",
        "resolved:/media/uploaded-avatar.png"
      );
    });
  });
});
