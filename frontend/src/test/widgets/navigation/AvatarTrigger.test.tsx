import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarTrigger } from "@widgets/navigation/AvatarTrigger";
import { resolveMediaUrl } from "@shared/api/core/media";
import { renderWithProviders } from "../../render";

vi.mock("@shared/api/core/media", () => ({
  resolveMediaUrl: vi.fn((value?: string) => `resolved:${value ?? ""}`),
}));

describe("AvatarTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the resolved profile image and handles clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderWithProviders(
      <AvatarTrigger
        user={{
          userId: 1,
          username: "devuser",
          email: "dev@example.com",
          profileImg: "/media/avatar.png",
        }}
        onClick={onClick}
      />
    );

    expect(resolveMediaUrl).toHaveBeenCalledWith("/media/avatar.png");
    expect(screen.getByAltText("devuser")).toHaveAttribute(
      "src",
      "resolved:/media/avatar.png"
    );

    await user.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("falls back to the user initial when no profile image exists", () => {
    renderWithProviders(
      <AvatarTrigger
        user={{
          userId: 2,
          username: "alice",
          email: "alice@example.com",
          profileImg: null,
        }}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByAltText("alice")).not.toBeInTheDocument();
  });
});
