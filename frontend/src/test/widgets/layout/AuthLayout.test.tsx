import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthLayout } from "@widgets/layout/AuthLayout";
import { renderWithProviders } from "../../render";

describe("AuthLayout", () => {
  it("renders the login shell with the default title and forgot-password footer", () => {
    renderWithProviders(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
      </Routes>,
      { route: "/login" }
    );

    expect(screen.getAllByText("BugBoard26").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("BugBoard26").length).toBeGreaterThan(0);
    expect(screen.getByText("Login form")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /forgot password\?/i })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("renders forgot-password title, subtitle and back-to-login footer", () => {
    renderWithProviders(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/forgot-password" element={<div>Recovery form</div>} />
        </Route>
      </Routes>,
      { route: "/forgot-password" }
    );

    expect(screen.getAllByText("Retrieve Password").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Insert your email to recover your password").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Recovery form")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to login/i })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("renders the verify subtitle on the otp verification route", () => {
    renderWithProviders(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/forgot-password/verify" element={<div>Verify form</div>} />
        </Route>
      </Routes>,
      { route: "/forgot-password/verify" }
    );

    expect(screen.getAllByText("Retrieve Password").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Insert OTP code and your new password").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Verify form")).toBeInTheDocument();
  });
});
