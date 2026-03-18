import { forwardRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";
import { IssueActivityTimeline } from "@features/issue/activity/IssueActivityTimeline";

vi.mock("@features/issue/activity/IssueActivityItem", () => ({
  IssueActivityItem: forwardRef<HTMLDivElement, { item: UiActivityItem; showNewMessageMarker?: boolean }>(
    ({ item, showNewMessageMarker = false }, ref) => (
      <div>
        {showNewMessageMarker ? <div ref={ref} data-testid="mock-inline-new-message-marker">NEW MESSAGE</div> : null}
        <div>{item.title}</div>
      </div>
    ),
  ),
}));

describe("IssueActivityTimeline", () => {
  const scrollIntoViewMock = vi.fn();
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalIntersectionObserver = globalThis.IntersectionObserver;
  let intersectionObserverCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(16);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
    intersectionObserverCallback = null;
    globalThis.IntersectionObserver = vi.fn(function (
      callback: typeof intersectionObserverCallback,
    ) {
      intersectionObserverCallback = callback as typeof intersectionObserverCallback;
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        root: null,
        rootMargin: "",
        thresholds: [0],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    globalThis.IntersectionObserver = originalIntersectionObserver;
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
        sort="OLDEST"
        scrollToItemId={11}
        onScrollToItemDone={onScrollToItemDone}
      />,
    );

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
    expect(onScrollToItemDone).toHaveBeenCalledWith(11);
  });

  it("reports when the user is near the latest edge for oldest-first timelines", async () => {
    const onLatestEdgeChange = vi.fn();
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
    ];

    render(<IssueActivityTimeline items={items} sort="OLDEST" onLatestEdgeChange={onLatestEdgeChange} />);

    const scrollPanel = screen.getByTestId("issue-activity-scroll-panel");
    Object.defineProperty(scrollPanel, "scrollHeight", { configurable: true, value: 500 });
    Object.defineProperty(scrollPanel, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scrollPanel, "scrollTop", { configurable: true, value: 252, writable: true });

    fireEvent.scroll(scrollPanel);

    await waitFor(() => {
      expect(onLatestEdgeChange).toHaveBeenLastCalledWith(true);
    });
  });

  it("reports when the user is near the latest edge for newest-first timelines", async () => {
    const onLatestEdgeChange = vi.fn();
    const items: UiActivityItem[] = [
      {
        id: 12,
        actorId: 1,
        actorName: "alice",
        actorProfileImg: null,
        at: "2026-03-15T10:00:00Z",
        eventType: "COMMENT",
        title: "Alice",
        message: "Latest message",
        isComment: true,
        attachments: [],
      },
    ];

    render(<IssueActivityTimeline items={items} sort="NEWEST" onLatestEdgeChange={onLatestEdgeChange} />);

    const scrollPanel = screen.getByTestId("issue-activity-scroll-panel");
    Object.defineProperty(scrollPanel, "scrollTop", { configurable: true, value: 20, writable: true });

    fireEvent.scroll(scrollPanel);

    await waitFor(() => {
      expect(onLatestEdgeChange).toHaveBeenLastCalledWith(true);
    });
  });

  it("renders the inline new-message marker above the targeted activity item", () => {
    const items: UiActivityItem[] = [
      {
        id: 21,
        actorId: 1,
        actorName: "alice",
        actorProfileImg: null,
        at: "2026-03-15T10:00:00Z",
        eventType: "COMMENT",
        title: "Alice",
        message: "First new message",
        isComment: true,
        attachments: [],
      },
      {
        id: 22,
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

    render(<IssueActivityTimeline items={items} sort="OLDEST" newMessageMarkerId={21} />);

    expect(screen.getByTestId("mock-inline-new-message-marker")).toHaveTextContent("NEW MESSAGE");
  });

  it("reports visibility changes for the inline new-message marker", async () => {
    const onNewMessageMarkerVisibilityChange = vi.fn();
    const items: UiActivityItem[] = [
      {
        id: 30,
        actorId: 1,
        actorName: "alice",
        actorProfileImg: null,
        at: "2026-03-15T10:00:00Z",
        eventType: "COMMENT",
        title: "Alice",
        message: "Marker target",
        isComment: true,
        attachments: [],
      },
    ];

    render(
      <IssueActivityTimeline
        items={items}
        sort="OLDEST"
        newMessageMarkerId={30}
        onNewMessageMarkerVisibilityChange={onNewMessageMarkerVisibilityChange}
      />,
    );

    expect(intersectionObserverCallback).not.toBeNull();

    act(() => {
      intersectionObserverCallback?.([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(onNewMessageMarkerVisibilityChange).toHaveBeenLastCalledWith(true);
    });
  });
});
