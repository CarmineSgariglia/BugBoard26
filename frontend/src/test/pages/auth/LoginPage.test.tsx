import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@pages/auth/LoginPage";
import { renderWithProviders } from "../../render";

const loginState = vi.hoisted(() => ({
  loginApi: vi.fn(),
  refreshUser: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@features/auth/api", () => ({
  loginApi: loginState.loginApi,
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: null,
    refreshUser: loginState.refreshUser,
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => loginState.navigate,
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginState.refreshUser.mockResolvedValue(undefined);
  });

  it("keeps the submit button disabled until the form is valid", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const submitButton = screen.getByRole("button", { name: /login/i });
    expect(submitButton.hasAttribute("disabled")).toBe(true);

    await user.type(screen.getByPlaceholderText("Email"), "bad@email");
    await user.type(screen.getByPlaceholderText("Password"), "short");

    expect(submitButton.hasAttribute("disabled")).toBe(true);
  });

  it("submits trimmed credentials, refreshes auth and navigates on success", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockResolvedValue({
      userId: 1,
      username: "devuser",
      email: "user@example.com",
    });

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Email"), "  user@example.com  ");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(loginState.loginApi).toHaveBeenCalledWith(
        "user@example.com",
        "Password1!"
      );
    });

    expect(loginState.refreshUser).toHaveBeenCalledTimes(1);
    expect(loginState.navigate).toHaveBeenCalledWith("/projects");
  });

  it("shows an error message when the login fails", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockRejectedValue(new Error("Unauthorized"));

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(loginState.navigate).not.toHaveBeenCalled();
  });
});
