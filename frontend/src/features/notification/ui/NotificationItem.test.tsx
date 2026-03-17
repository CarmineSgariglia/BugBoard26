import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { NotificationItem } from "./NotificationItem";

describe("NotificationItem", () => {
  it("triggers the main click action from keyboard activation", async () => {
    const onClick = vi.fn();

    render(
      <NotificationItem
        title="Issue updated"
        description="Issue #42"
        time="now"
        unread
        onClick={onClick}
      />,
    );

    const item = screen.getByRole("button");
    item.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("marks as read and deletes without bubbling to the main click handler", async () => {
    const onClick = vi.fn();
    const onMarkRead = vi.fn();
    const onDelete = vi.fn();

    render(
      <NotificationItem
        title="Issue updated"
        description="Issue #42"
        time="now"
        unread
        onClick={onClick}
        onMarkRead={onMarkRead}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByTitle("Mark as read"));
    await userEvent.click(screen.getByTitle("Delete notification"));

    expect(onMarkRead).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders an image when one is provided", () => {
    const { container } = render(
      <NotificationItem
        title="Avatar notification"
        description="Issue #99"
        time="later"
        imageUrl="/avatar.png"
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute("src", "/avatar.png");
  });
});
