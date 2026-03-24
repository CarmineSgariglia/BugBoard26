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
});
