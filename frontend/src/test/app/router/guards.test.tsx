import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicOnly, RequireAuth } from "@app/router/guards";
import { renderWithProviders } from "../../render";

const authGuardState = vi.hoisted(() => ({
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
    user: authGuardState.user,
    isLoading: authGuardState.isLoading,
    refreshUser: vi.fn(),
  }),
}));

describe("guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGuardState.user = null;
    authGuardState.isLoading = false;
  });

  it("shows the loading shell while auth state is resolving", () => {
    authGuardState.isLoading = true;

    const { container } = renderWithProviders(
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected page</div>
            </RequireAuth>
          }
        />
      </Routes>,
      { route: "/protected" }
    );

    expect(screen.queryByText("Protected page")).not.toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "min-h-screen"
    );
  });

  it("redirects guests away from protected routes", () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected page</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>,
      { route: "/protected" }
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    authGuardState.user = {
      userId: 1,
      username: "devuser",
      email: "dev@example.com",
    };

    renderWithProviders(
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected page</div>
            </RequireAuth>
          }
        />
      </Routes>,
      { route: "/protected" }
    );

    expect(screen.getByText("Protected page")).toBeInTheDocument();
  });

  it("redirects authenticated users away from public-only routes", () => {
    authGuardState.user = {
      userId: 1,
      username: "devuser",
      email: "dev@example.com",
    };

    renderWithProviders(
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <div>Login page</div>
            </PublicOnly>
          }
        />
        <Route path="/projects" element={<div>Projects page</div>} />
      </Routes>,
      { route: "/login" }
    );

    expect(screen.getByText("Projects page")).toBeInTheDocument();
  });

  it("renders public-only content for guests", () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <div>Login page</div>
            </PublicOnly>
          }
        />
      </Routes>,
      { route: "/login" }
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });
});
