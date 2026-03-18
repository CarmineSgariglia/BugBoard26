import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SidebarMembersSection } from "@widgets/layout/SidebarMembersSection";
import { renderWithProviders } from "../../render";

describe("SidebarMembersSection", () => {
  it("renders the admin action and forwards the click", async () => {
    const user = userEvent.setup();
    const onActionClick = vi.fn();

    renderWithProviders(
      <SidebarMembersSection
        members={[
          { username: "alice", profileImg: null },
          { username: "bob", profileImg: null },
        ]}
        isAdmin={true}
        onActionClick={onActionClick}
      />
    );

    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage members/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /manage members/i }));

    expect(onActionClick).toHaveBeenCalledTimes(1);
  });

  it("shows empty text and the user action label for non-admin viewers", () => {
    renderWithProviders(
      <SidebarMembersSection
        members={[]}
        isAdmin={false}
        emptyText="No members assigned yet."
      />
    );

    expect(
      screen.getByRole("button", { name: /view members/i })
    ).toBeInTheDocument();
    expect(screen.getByText("No members assigned yet.")).toBeInTheDocument();
  });
});
