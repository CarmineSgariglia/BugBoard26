import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@pages/auth/LoginPage";
import { renderWithProviders } from "../../render";

const loginState = vi.hoisted(() => ({
  ensureCsrfCookieReady: vi.fn(),
  loginApi: vi.fn(),
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  ensureCsrfCookieReady: loginState.ensureCsrfCookieReady,
}));

vi.mock("@features/auth/api", () => ({
  loginApi: loginState.loginApi,
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: null,
    refreshUser: loginState.refreshUser,
    setAuthenticatedUser: loginState.setAuthenticatedUser,
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => loginState.navigate,
  };
});

function createAxiosError(status?: number, options?: { code?: string; url?: string }) {
  return {
    isAxiosError: true,
    response: typeof status === "number" ? { status } : undefined,
    code: options?.code,
    config: options?.url ? { url: options.url } : undefined,
  };
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    loginState.ensureCsrfCookieReady.mockResolvedValue(true);
    loginState.setAuthenticatedUser.mockReset();
    loginState.refreshUser.mockResolvedValue({
      userId: 1,
      username: "devuser",
      email: "user@example.com",
      firstName: "Dev",
      lastName: "User",
      isAdmin: false,
      profileImg: "",
      active: true,
    });
  });

  it("keeps the submit button disabled until the form is valid and csrf bootstrap completes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const submitButton = screen.getByRole("button", { name: /login/i });
    expect(submitButton.hasAttribute("disabled")).toBe(true);

    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "bad@email");
    await user.type(screen.getByPlaceholderText("Password"), "short");

    expect(submitButton.hasAttribute("disabled")).toBe(true);
  });

  it("submits trimmed credentials, primes auth immediately and navigates", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockResolvedValue({
      userId: 1,
      username: "devuser",
      email: "user@example.com",
      firstName: "Dev",
      lastName: "User",
      isAdmin: false,
      profileImg: "",
      active: true,
    });

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "  user@example.com  ");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /login/i }).hasAttribute("disabled")).toBe(false);
    });
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(loginState.loginApi).toHaveBeenCalledWith("user@example.com", "Password1!");
    });

    expect(loginState.setAuthenticatedUser).toHaveBeenCalledWith({
      userId: 1,
      username: "devuser",
      email: "user@example.com",
      firstName: "Dev",
      lastName: "User",
      isAdmin: false,
      profileImg: "",
      active: true,
    });
    expect(loginState.refreshUser).toHaveBeenCalledTimes(1);
    expect(loginState.navigate).toHaveBeenCalledWith("/projects");
  });

  it("submits autofilled DOM credentials even when React state was never updated", async () => {
    loginState.loginApi.mockResolvedValue({
      userId: 1,
      username: "devuser",
      email: "user@example.com",
      firstName: "Dev",
      lastName: "User",
      isAdmin: false,
      profileImg: "",
      active: true,
    });

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    const emailInput = screen.getByPlaceholderText("Email") as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText("Password") as HTMLInputElement;
    const form = emailInput.closest("form");

    emailInput.value = "  user@example.com  ";
    passwordInput.value = "Password1!";

    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(loginState.loginApi).toHaveBeenCalledWith("user@example.com", "Password1!");
    });
    expect(loginState.navigate).toHaveBeenCalledWith("/projects");
  });

  it("retries csrf preparation on submit when the initial warmup does not make the cookie ready", async () => {
    const user = userEvent.setup();
    loginState.ensureCsrfCookieReady.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    loginState.loginApi.mockResolvedValue({
      userId: 1,
      username: "devuser",
      email: "user@example.com",
    });

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /login/i }).hasAttribute("disabled")).toBe(false);
    });
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(2);
    });
    expect(loginState.loginApi).toHaveBeenCalledWith("user@example.com", "Password1!");
  });

  it("shows invalid credentials only for a real 401 response", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockRejectedValue(createAxiosError(401, { url: "/sessions" }));

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(loginState.navigate).not.toHaveBeenCalled();
  });

  it("shows a dedicated security message for csrf or 403 login failures", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockRejectedValue(createAxiosError(403, { url: "/sessions" }));

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(
      await screen.findByText("We couldn't validate the secure session. Please try again.")
    ).toBeInTheDocument();
  });

  it("shows a throttling message for 429 responses", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockRejectedValue(createAxiosError(429, { url: "/sessions" }));

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(
      await screen.findByText("Too many login attempts. Please wait a moment and try again.")
    ).toBeInTheDocument();
  });

  it("shows a timeout message when the login request exceeds the client timeout", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockRejectedValue(
      createAxiosError(undefined, { code: "ECONNABORTED", url: "/sessions" }),
    );

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(
      await screen.findByText("The login request took too long. Please try again.")
    ).toBeInTheDocument();
  });

  it("shows a network message when the backend is temporarily unreachable", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockRejectedValue(createAxiosError(undefined, { url: "/sessions" }));

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText("We couldn't reach the server. Please try again.")).toBeInTheDocument();
  });

  it("logs a background sync warning when the post-login refresh cannot confirm the session", async () => {
    const user = userEvent.setup();
    loginState.loginApi.mockResolvedValue({
      userId: 1,
      username: "devuser",
      email: "user@example.com",
      firstName: "Dev",
      lastName: "User",
      isAdmin: false,
      profileImg: "",
      active: true,
    });
    loginState.refreshUser.mockResolvedValue(null);

    renderWithProviders(<LoginPage />);
    await waitFor(() => {
      expect(loginState.ensureCsrfCookieReady).toHaveBeenCalledTimes(1);
    });

    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(loginState.navigate).toHaveBeenCalledWith("/projects");
    });
    expect(console.warn).toHaveBeenCalledWith(
      "post_login_sync_failed",
      expect.objectContaining({
        requestUrl: "/users/me",
        reason: "missing_user",
      }),
    );
  });
});
