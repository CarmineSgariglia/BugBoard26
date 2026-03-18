import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvatarGroup } from "@shared/ui/AvatarGroup";

describe("AvatarGroup", () => {
  const members = [
    { username: "Alice", profileImg: "/alice.png" },
    { username: "Bob", profileImg: null },
    { username: "Charlie" },
    { username: "David" },
    { username: "Eve" },
  ];

  it("renders up to max members and residual badge", () => {
    render(<AvatarGroup members={members} max={3} />);
    
    // Checks images that should be visible
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3); 
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders action button when provided", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <AvatarGroup 
        members={members.slice(0, 2)} 
        action={{ icon: <span>Action</span>, label: "Add Member", onClick }} 
      />
    );

    const button = screen.getByRole("button", { name: "Add Member" });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
