import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSidebar } from "@features/project/ui/ProjectSidebar";
import { renderWithProviders } from "../../../render";

vi.mock("@shared/ui/ScrollComponent", () => ({
  ScrollComponent: ({
    children,
    maxHeight,
  }: {
    children: ReactNode;
    maxHeight: string;
  }) => (
    <div data-testid="scroll-component" data-max-height={maxHeight}>
      {children}
    </div>
  ),
}));

vi.mock("@widgets/layout/SidebarCard", () => {
  const SidebarCard = ({ children }: { children: ReactNode }) => (
    <div data-testid="sidebar-card">{children}</div>
  );

  SidebarCard.Section = ({
    title,
    children,
  }: {
    title: string;
    children: ReactNode;
  }) => (
    <section>
      <h4>{title}</h4>
      {children}
    </section>
  );

  return { SidebarCard };
});

vi.mock("@widgets/layout/SidebarMembersSection", () => ({
  SidebarMembersSection: ({
    title,
    members,
    isAdmin,
    onActionClick,
    adminLabel,
    userLabel,
  }: {
    title: string;
    members: Array<{ username: string }>;
    isAdmin?: boolean;
    onActionClick?: () => void;
    adminLabel: string;
    userLabel: string;
  }) => (
    <div data-testid="members-section">
      <span>{title}</span>
      <span>{members.map((member) => member.username).join(", ")}</span>
      <button onClick={onActionClick}>{isAdmin ? adminLabel : userLabel}</button>
    </div>
  ),
}));

describe("ProjectSidebar", () => {
  const baseProject = {
    projectId: 10,
    name: "Orbit",
    createdAt: "2026-03-18T10:00:00.000Z",
    description: "Mission control dashboard for the release team.",
    color: "#1F2937",
    icon: "rocket",
    createdBy: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows project details and admin actions", async () => {
    const user = userEvent.setup();
    const onSettingsClick = vi.fn();
    const onEditTeamClick = vi.fn();

    renderWithProviders(
      <ProjectSidebar
        project={baseProject}
        members={[
          { username: "alice", profileImg: null },
          { username: "bob", profileImg: null },
        ]}
        isAdmin={true}
        onSettingsClick={onSettingsClick}
        onEditTeamClick={onEditTeamClick}
      />
    );

    expect(screen.getByTestId("sidebar-card")).toBeInTheDocument();
    expect(screen.getByText("Project Description")).toBeInTheDocument();
    expect(
      screen.getByText("Mission control dashboard for the release team.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("scroll-component")).toHaveAttribute(
      "data-max-height",
      "max-h-[150px]"
    );
    expect(screen.getByText("alice, bob")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage members/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit project/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /manage members/i }));
    await user.click(screen.getByRole("button", { name: /edit project/i }));

    expect(onEditTeamClick).toHaveBeenCalledTimes(1);
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });

  it("shows the fallback description and view action for non-admin members", async () => {
    const user = userEvent.setup();
    const onViewTeamClick = vi.fn();

    renderWithProviders(
      <ProjectSidebar
        project={{ ...baseProject, description: "" }}
        members={[{ username: "carol", profileImg: null }]}
        isAdmin={false}
        onViewTeamClick={onViewTeamClick}
      />
    );

    expect(
      screen.getByText("No description provided for this project.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view members/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit project/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view members/i }));

    expect(onViewTeamClick).toHaveBeenCalledTimes(1);
  });
});
