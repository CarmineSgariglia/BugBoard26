import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";

import { server } from "../../../mocks/server";
import { renderWithProviders } from "../../../render";
import { AuthProvider, useAuth } from "../../../../features/auth/providers/AuthProvider";

function AuthProbe() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p>loading</p>;
  }

  return <p>{user ? `${user.firstName} ${user.lastName}`.trim() : "guest"}</p>;
}

describe("AuthProvider", () => {
  it("exposes the authenticated user when /auth/me succeeds", async () => {
    renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Dev User")).toBeInTheDocument();
  });

  it("falls back to guest when /auth/me returns unauthorized", async () => {
    server.use(
      http.get("/api/auth/me", () => HttpResponse.json({ detail: "Unauthorized" }, { status: 401 })),
    );

    renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("guest")).toBeInTheDocument();
  });
});
