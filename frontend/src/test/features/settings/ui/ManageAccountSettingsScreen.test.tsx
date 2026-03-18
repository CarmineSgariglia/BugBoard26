import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ManageAccountSettingsScreen } from "@features/settings/ui/ManageAccountSettingsScreen";
import { renderWithProviders } from "../../../render";
import { useAuth } from "@features/auth";

vi.mock("@features/auth");

describe("ManageAccountSettingsScreen", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userId: 1, username: "boss", isAdmin: true },
    } as any);
  });

  it("renders Sidebar and transitions tabs", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ManageAccountSettingsScreen />);

    // Sidebar options displayed
    expect(screen.getAllByText("Profile Settings")[0]).toBeInTheDocument();
    expect(screen.getByText("Add Users")).toBeInTheDocument();

    // Click on Add Users trigger
    await user.click(screen.getByText("Add Users"));

    // Verify AddUsers section gets rendered instead of Profile
    expect(screen.getByText("Add New User")).toBeInTheDocument();
  });
});
