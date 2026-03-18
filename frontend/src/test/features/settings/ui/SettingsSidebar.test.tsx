import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsSidebar } from "@features/settings/ui/SettingsSidebar";
import { renderWithProviders } from "../../../render";

const sidebarState = vi.hoisted(() => ({
  navigate: vi.fn(),
  handleGetHelp: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => sidebarState.navigate,
  };
});

vi.mock("@shared/lib/help", () => ({
  handleGetHelp: sidebarState.handleGetHelp,
}));

describe("SettingsSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the available tabs and highlights the active one", () => {
    const { container } = renderWithProviders(
      <SettingsSidebar activeTab="profile" onTabChange={vi.fn()} />
    );

    expect(screen.getByText("Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("Add Users")).toBeInTheDocument();
    expect(screen.getByText("Manage Users")).toBeInTheDocument();
    expect(screen.getByText("Get Help")).toBeInTheDocument();
    expect(screen.getByText("Exit")).toBeInTheDocument();

    const activeTab = screen.getAllByText("Profile Settings")[0].closest("div") as HTMLElement;
    expect(activeTab.className).toContain("cursor-default");
    expect(container.textContent).toContain("Admin Controls");
  });

  it("changes tab only when clicking a non-active entry", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    renderWithProviders(
      <SettingsSidebar activeTab="profile" onTabChange={onTabChange} />
    );

    await user.click(screen.getByText("Profile Settings"));
    await user.click(screen.getByText("Add Users"));
    await user.click(screen.getByText("Manage Users"));

    expect(onTabChange).toHaveBeenCalledTimes(2);
    expect(onTabChange).toHaveBeenNthCalledWith(1, "add_users");
    expect(onTabChange).toHaveBeenNthCalledWith(2, "manage_users");
  });

  it("opens help and navigates back from the footer actions", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SettingsSidebar activeTab="profile" onTabChange={vi.fn()} />
    );

    await user.click(screen.getByText("Get Help"));
    await user.click(screen.getByText("Exit"));

    expect(sidebarState.handleGetHelp).toHaveBeenCalledTimes(1);
    expect(sidebarState.navigate).toHaveBeenCalledWith(-1);
  });
});
