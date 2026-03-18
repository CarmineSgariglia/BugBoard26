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

    expect(screen.getByText("BugBoard26")).toBeInTheDocument();
    expect(screen.getByAltText("BugBoard26 Logo")).toBeInTheDocument();
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

    expect(screen.getByText("Retrieve Password")).toBeInTheDocument();
    expect(
      screen.getByText("Insert your email to recover your password")
    ).toBeInTheDocument();
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

    expect(screen.getByText("Retrieve Password")).toBeInTheDocument();
    expect(
      screen.getByText("Insert OTP code and your new password")
    ).toBeInTheDocument();
    expect(screen.getByText("Verify form")).toBeInTheDocument();
  });
});
