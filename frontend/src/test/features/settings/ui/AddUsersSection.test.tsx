import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AddUsersSection } from "@features/settings/ui/AddUsersSection";
import { renderWithProviders } from "../../../render";
import { createSettingsUserApi } from "@features/settings/api";

// Mock API
vi.mock("@features/settings/api", () => ({
  createSettingsUserApi: vi.fn(),
}));

describe("AddUsersSection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates state and triggers create api with valid form", async () => {
    const user = userEvent.setup();
    const mockCreateApi = vi.mocked(createSettingsUserApi).mockResolvedValue({} as any);

    renderWithProviders(<AddUsersSection />);

    // Identity fields: Name uses testId or inputs, let's look generically for placeholders if custom
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3); // Name, Surname, Email

    // Mock inputs setup: Add name, surname, email
    await user.type(inputs[0], "Mario");
    await user.type(inputs[1], "Rossi");
    await user.type(inputs[2], "mario.rossi@example.com");

    const submitBtn = screen.getByRole("button", { name: /Add User/i });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);

    await user.click(submitBtn);

    expect(mockCreateApi).toHaveBeenCalledWith(expect.objectContaining({
      email: "mario.rossi@example.com",
      firstName: "Mario",
      lastName: "Rossi"
    }));
  });
});
