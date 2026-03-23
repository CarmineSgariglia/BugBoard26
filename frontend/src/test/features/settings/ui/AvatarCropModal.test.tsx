import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarCropModal } from "@features/settings/ui";
import { renderWithProviders } from "../../../../test/render";

const { cropProfileImageMock } = vi.hoisted(() => ({
  cropProfileImageMock: vi.fn(),
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
          width: 128,
          height: 128,
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

describe("AvatarCropModal", () => {
  beforeEach(() => {
    cropProfileImageMock.mockReset();
  });

  it("renders the cropper and controls when open", () => {
    renderWithProviders(
      <AvatarCropModal
        isOpen={true}
        imageFile={new File(["avatar"], "avatar.png", { type: "image/png" })}
        imageSrc="blob:avatar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Adjust profile picture")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-cropper")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotation")).toBeInTheDocument();
  });

  it("confirms the cropped file", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const sourceFile = new File(["avatar"], "avatar.png", { type: "image/png" });
    const croppedFile = new File(["cropped"], "avatar-cropped.png", { type: "image/png" });
    cropProfileImageMock.mockResolvedValue(croppedFile);

    renderWithProviders(
      <AvatarCropModal
        isOpen={true}
        imageFile={sourceFile}
        imageSrc="blob:avatar"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply crop" })).not.toHaveAttribute("disabled");
    });
    await user.click(screen.getByRole("button", { name: "Apply crop" }));

    await waitFor(() => {
      expect(cropProfileImageMock).toHaveBeenCalled();
    });
    expect(onConfirm).toHaveBeenCalledWith(croppedFile);
  });

  it("cancels without confirming", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderWithProviders(
      <AvatarCropModal
        isOpen={true}
        imageFile={new File(["avatar"], "avatar.png", { type: "image/png" })}
        imageSrc="blob:avatar"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
