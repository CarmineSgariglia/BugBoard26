import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";
import { IssueActivityTimeline } from "./IssueActivityTimeline";

vi.mock("./IssueActivityItem", () => ({
  IssueActivityItem: ({ item }: { item: UiActivityItem }) => <div>{item.title}</div>,
}));

describe("IssueActivityTimeline", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls to the requested activity item and notifies completion", () => {
    const items: UiActivityItem[] = [
      {
        id: 10,
        actorId: 1,
        actorName: "alice",
        actorProfileImg: null,
        at: "2026-03-15T10:00:00Z",
        eventType: "COMMENT",
        title: "Alice",
        message: "First message",
        isComment: true,
        attachments: [],
      },
      {
        id: 11,
        actorId: 2,
        actorName: "bob",
        actorProfileImg: null,
        at: "2026-03-15T10:01:00Z",
        eventType: "COMMENT",
        title: "Bob",
        message: "Second message",
        isComment: true,
        attachments: [],
      },
    ];

    const onScrollToItemDone = vi.fn();

    render(
      <IssueActivityTimeline
        items={items}
        scrollToItemId={11}
        onScrollToItemDone={onScrollToItemDone}
      />,
    );

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(onScrollToItemDone).toHaveBeenCalledWith(11);
  });
});
