import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { server } from "../../../mocks/server";
import { renderWithProviders } from "../../../render";
import { AuthProvider } from "../../../../features/auth/providers/AuthProvider";
import { useAuth } from "../../../../features/auth/providers/useAuth";

function AuthProbe() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p>loading</p>;
  }

  return <p>{user ? `${user.firstName} ${user.lastName}`.trim() : "guest"}</p>;
}

function RefreshProbe() {
  const { refreshUser } = useAuth();
  const [result, setResult] = useState("idle");

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const user = await refreshUser();
          setResult(user ? user.email : "guest");
        }}
      >
        refresh
      </button>
      <p>{result}</p>
    </>
  );
}

function RefreshPreserveProbe() {
  const { refreshUser, setAuthenticatedUser, user } = useAuth();
  const [result, setResult] = useState("idle");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAuthenticatedUser({
            userId: 7,
            username: "preserved",
            email: "preserved@example.com",
            firstName: "Preserved",
            lastName: "User",
            isAdmin: false,
            profileImg: "",
            active: true,
          });
        }}
      >
        seed
      </button>
      <button
        type="button"
        onClick={async () => {
          const user = await refreshUser({ clearOnUnauthorized: false });
          setResult(user ? user.email : "guest");
        }}
      >
        refresh-keep
      </button>
      <p>{result}</p>
      <p>{user ? user.email : "guest-user"}</p>
    </>
  );
}

function PrimeProbe() {
  const { setAuthenticatedUser, user } = useAuth();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAuthenticatedUser({
            userId: 9,
            username: "primed",
            email: "primed@example.com",
            firstName: "Primed",
            lastName: "User",
            isAdmin: false,
            profileImg: "",
            active: true,
          });
        }}
      >
        prime
      </button>
      <p>{user ? user.email : "guest"}</p>
    </>
  );
}

describe("AuthProvider", () => {
  it("exposes the authenticated user when /users/me succeeds", async () => {
    renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Dev User")).toBeInTheDocument();
  });

  it("falls back to guest when /users/me returns unauthorized", async () => {
    server.use(
      http.get("/api/users/me", () => HttpResponse.json({ detail: "Unauthorized" }, { status: 401 })),
    );

    renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("guest")).toBeInTheDocument();
  });

  it("returns the current user from refreshUser when the session is valid", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /refresh/i }));

    expect(await screen.findByText("dev@test.it")).toBeInTheDocument();
  });

  it("returns null from refreshUser when /users/me is unauthorized", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/users/me", () => HttpResponse.json({ detail: "Unauthorized" }, { status: 401 })),
    );

    renderWithProviders(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /refresh/i }));

    expect(await screen.findByText("guest")).toBeInTheDocument();
  });

  it("can preserve the current user on unauthorized refresh when requested", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/users/me", () => HttpResponse.json({ detail: "Unauthorized" }, { status: 401 })),
    );

    renderWithProviders(
      <AuthProvider>
        <RefreshPreserveProbe />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /seed/i }));
    await user.click(screen.getByRole("button", { name: /refresh-keep/i }));

    expect(await screen.findByText("guest")).toBeInTheDocument();
    expect(await screen.findByText("preserved@example.com")).toBeInTheDocument();
  });

  it("allows priming the authenticated user without waiting for /users/me", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AuthProvider>
        <PrimeProbe />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /prime/i }));

    expect(await screen.findByText("primed@example.com")).toBeInTheDocument();
  });
});
