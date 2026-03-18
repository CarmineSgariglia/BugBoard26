import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MainLayout } from "@widgets/layout/MainLayout";
import { renderWithProviders } from "../../render";

vi.mock("@widgets/layout/AppBackground", () => ({
  AppBackground: () => <div>App background</div>,
}));

vi.mock("@widgets/navigation/TopNav", () => ({
  TopNav: () => <div>Top navigation</div>,
}));

vi.mock("@features/notification/ui/NotificationsRealtimeListener", () => ({
  NotificationsRealtimeListener: () => <div>Notifications listener</div>,
}));

describe("MainLayout", () => {
  it("renders background, realtime listener, top nav and nested route content", () => {
    renderWithProviders(
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/projects" element={<div>Projects page</div>} />
        </Route>
      </Routes>,
      { route: "/projects" }
    );

    expect(screen.getByText("App background")).toBeInTheDocument();
    expect(screen.getByText("Notifications listener")).toBeInTheDocument();
    expect(screen.getByText("Top navigation")).toBeInTheDocument();
    expect(screen.getByText("Projects page")).toBeInTheDocument();
  });
});
