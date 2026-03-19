import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IssueDetailsSidebar } from "@features/issue/ui/IssueDetailsSidebar";
import { renderWithProviders } from "../../../render";
import type { Issue } from "@shared/api/types/issues";

// SidebarCard and SidebarMembersSection use widgets layout — mock them for isolation
vi.mock("@widgets/layout/SidebarCard", () => ({
  SidebarCard: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div data-testid="sidebar-card">{children}</div>,
}));

vi.mock("@widgets/layout/SidebarMembersSection", () => ({
  SidebarMembersSection: ({
    title,
    members,
    onActionClick,
    emptyText,
    adminLabel,
    userLabel,
    isAdmin,
  }: {
    title: string;
    members: Array<{ userId: number; username: string }>;
    onActionClick?: () => void;
    emptyText: string;
    adminLabel: string;
    userLabel: string;
    isAdmin?: boolean;
  }) => (
    <div>
      <span>{title}</span>
      {members.length === 0 ? (
        <span>{emptyText}</span>
      ) : (
        members.map((m) => <span key={m.userId}>{m.username}</span>)
      )}
      {onActionClick && (
        <button onClick={onActionClick}>
          {isAdmin ? adminLabel : userLabel}
        </button>
      )}
    </div>
  ),
}));

// SidebarCard.Section is used as a sub-component — provide it in the mock
vi.mock("@widgets/layout/SidebarCard", () => ({
  SidebarCard: Object.assign(
    ({ children }: { children: React.ReactNode }) => (
      <div data-testid="sidebar-card">{children}</div>
    ),
    {
      Section: ({
        title,
        children,
        className,
      }: {
        title: string;
        children: React.ReactNode;
        className?: string;
      }) => (
        <div className={className}>
          <span>{title}</span>
          {children}
        </div>
      ),
    }
  ),
}));

const baseIssue: Issue = {
  issueId: 5,
  projectId: 1,
  title: "Sample Bug",
  description: "A bug description",
  status: "IN_PROGRESS",
  priority: "HIGH",
  type: "BUG",
  assignees: [],
  tags: [],
  reporter: {
    userId: 99,
    username: "reporter_user",
    email: "reporter@example.com",
    profileImg: null,
  },
  createdAt: "2026-01-01T00:00:00Z",
} as any;

describe("IssueDetailsSidebar", () => {
  it("renders Status section with correct badge text", () => {
    renderWithProviders(<IssueDetailsSidebar issue={baseIssue} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("IN PROGRESS")).toBeInTheDocument();
  });

  it("renders Priority section with the correct priority", () => {
    renderWithProviders(<IssueDetailsSidebar issue={baseIssue} />);
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders Type section with the issue type tag", () => {
    renderWithProviders(<IssueDetailsSidebar issue={baseIssue} />);
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("BUG")).toBeInTheDocument();
  });

  it("renders Reporter section with username and email", () => {
    renderWithProviders(<IssueDetailsSidebar issue={baseIssue} />);
    expect(screen.getByText("reporter_user")).toBeInTheDocument();
    expect(screen.getByText("reporter@example.com")).toBeInTheDocument();
  });

  it("renders Unknown Reporter when reporter is null", () => {
    const issueNoReporter = { ...baseIssue, reporter: null };
    renderWithProviders(<IssueDetailsSidebar issue={issueNoReporter as any} />);
    expect(screen.getByText("Unknown Reporter")).toBeInTheDocument();
  });

  it("shows 'No tags' when tags array is empty", () => {
    renderWithProviders(<IssueDetailsSidebar issue={baseIssue} />);
    expect(screen.getByText("No tags")).toBeInTheDocument();
  });

  it("renders tags when present", () => {
    const issueWithTags = {
      ...baseIssue,
      tags: [
        { tagId: 1, name: "frontend" },
        { tagId: 2, name: "critical" },
      ],
    };
    renderWithProviders(<IssueDetailsSidebar issue={issueWithTags as any} />);
    expect(screen.getByText("FRONTEND")).toBeInTheDocument();
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
  });

  it("shows Edit Issue button when isAdmin is true", () => {
    renderWithProviders(
      <IssueDetailsSidebar issue={baseIssue} isAdmin={true} />
    );
    expect(screen.getByText("Edit Issue")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /issue notifications/i })).toBeInTheDocument();
  });

  it("shows Edit Issue button when isAssigned is true", () => {
    renderWithProviders(
      <IssueDetailsSidebar issue={baseIssue} isAssigned={true} />
    );
    expect(screen.getByText("Edit Issue")).toBeInTheDocument();
  });

  it("hides Edit Issue button when neither isAdmin nor isAssigned", () => {
    renderWithProviders(<IssueDetailsSidebar issue={baseIssue} />);
    expect(screen.queryByText("Edit Issue")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: /issue notifications/i })
    ).not.toBeInTheDocument();
  });

  it("calls onEditClick when Edit Issue button is clicked", async () => {
    const onEditClick = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <IssueDetailsSidebar
        issue={baseIssue}
        isAdmin={true}
        onEditClick={onEditClick}
      />
    );
    await user.click(screen.getByText("Edit Issue"));
    expect(onEditClick).toHaveBeenCalledTimes(1);
  });

  it("shows 'No one assigned' when assignees list is empty", () => {
    renderWithProviders(<IssueDetailsSidebar issue={baseIssue} />);
    expect(screen.getByText("No one assigned")).toBeInTheDocument();
  });

  it("calls onSubscriptionChange when the admin toggle is clicked", async () => {
    const onSubscriptionChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <IssueDetailsSidebar
        issue={baseIssue}
        isAdmin={true}
        subscriptionChecked={false}
        onSubscriptionChange={onSubscriptionChange}
      />
    );

    await user.click(screen.getByRole("switch", { name: /issue notifications/i }));

    expect(onSubscriptionChange).toHaveBeenCalledWith(true);
  });

  it("disables the notifications toggle while the subscription is pending", () => {
    renderWithProviders(
      <IssueDetailsSidebar
        issue={baseIssue}
        isAdmin={true}
        subscriptionChecked={true}
        subscriptionDisabled={true}
      />
    );

    expect(screen.getByRole("switch", { name: /issue notifications/i })).toHaveAttribute(
      "disabled"
    );
  });

  it("shows the project-disabled reason on the blocked issue toggle", () => {
    renderWithProviders(
      <IssueDetailsSidebar
        issue={baseIssue}
        isAdmin={true}
        subscriptionChecked={true}
        subscriptionDisabled={true}
        subscriptionDisabledReason="Project notifications disabled"
      />
    );

    expect(screen.getByTitle("Project notifications disabled")).toBeInTheDocument();
    expect(screen.getByText("Project notifications disabled")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /issue notifications/i })).toHaveAttribute(
      "disabled"
    );
  });

  it("shows the inline subscription error for admins", () => {
    renderWithProviders(
      <IssueDetailsSidebar
        issue={baseIssue}
        isAdmin={true}
        subscriptionError="Unable to load notification preference."
      />
    );

    expect(
      screen.getByText("Unable to load notification preference.")
    ).toBeInTheDocument();
  });
});
