import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Outlet } from "react-router-dom";

import { AppRouter } from "@app/router/AppRouter";
import { render } from "@testing-library/react";

const authRouterState = vi.hoisted(() => ({
  user: null as
    | {
        userId: number;
        username: string;
        email: string;
      }
    | null,
  isLoading: false,
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: authRouterState.user,
    isLoading: authRouterState.isLoading,
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@widgets/layout/AuthLayout", () => ({
  AuthLayout: () => (
    <div>
      <span>Auth layout</span>
      <Outlet />
    </div>
  ),
}));

vi.mock("@widgets/layout/MainLayout", () => ({
  MainLayout: () => (
    <div>
      <span>Main layout</span>
      <Outlet />
    </div>
  ),
}));

vi.mock("@shared/providers", () => ({
  BreadcrumbProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@pages/auth/LoginPage", () => ({
  LoginPage: () => <div>Login page</div>,
}));

vi.mock("@pages/auth/RecoverPasswordRequestPage", () => ({
  RecoverPasswordRequestPage: () => <div>Recover password request</div>,
}));

vi.mock("@pages/auth/RecoverPasswordVerifyPage", () => ({
  RecoverPasswordVerifyPage: () => <div>Recover password verify</div>,
}));

vi.mock("@pages/projects/ProjectsPage", () => ({
  ProjectsPage: () => <div>Projects page</div>,
}));

vi.mock("@pages/projects/ProjectIssuesPage", () => ({
  ProjectIssuesPage: () => <div>Project issues page</div>,
}));

vi.mock("@pages/issues/IssuePage", () => ({
  IssuePage: () => <div>Issue page</div>,
}));

vi.mock("@pages/settings/ManageAccountSettingsPage", () => ({
  ManageAccountSettingsPage: () => <div>Settings page</div>,
}));

describe("AppRouter", () => {
  beforeEach(() => {
    authRouterState.user = null;
    authRouterState.isLoading = false;
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("allows authenticated users to open forgot-password", async () => {
    authRouterState.user = {
      userId: 1,
      username: "devuser",
      email: "dev@example.com",
    };
    window.history.replaceState({}, "", "/forgot-password");

    render(<AppRouter />);

    expect(await screen.findByText("Recover password request")).toBeInTheDocument();
    expect(screen.queryByText("Projects page")).not.toBeInTheDocument();
  });
});
