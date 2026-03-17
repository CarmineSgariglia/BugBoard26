import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@shared/api/types/auth";
import type { IssueUpdate } from "@shared/api/types/issues";
import { renderWithProviders } from "../../../test/render";
import { IssueActivityPanel } from "./IssueActivityPanel";

const {
  createIssueUpdateApiMock,
  listIssueUpdatesApiMock,
  timelineState,
  realtimeListenerState,
} = vi.hoisted(() => ({
  createIssueUpdateApiMock: vi.fn(),
  listIssueUpdatesApiMock: vi.fn(),
  timelineState: { props: null as null | Record<string, unknown> },
  realtimeListenerState: { props: null as null | Record<string, unknown> },
}));

vi.mock("@shared/api/modules/issues", () => ({
  createIssueUpdateApi: createIssueUpdateApiMock,
  listIssueUpdatesApi: listIssueUpdatesApiMock,
}));

vi.mock("./IssueActivityComposer", () => ({
  IssueActivityComposer: () => null,
}));

vi.mock("./IssueActivityFilters", () => ({
  IssueActivityFilters: ({
    scope,
    sort,
    onScopeChange,
    onSortChange,
  }: {
    scope: "ALL" | "YOURS";
    sort: "NEWEST" | "OLDEST";
    onScopeChange: (value: "ALL" | "YOURS") => void;
    onSortChange: (value: "NEWEST" | "OLDEST") => void;
  }) => (
    <div>
      <span data-testid="scope-value">{scope}</span>
      <span data-testid="sort-value">{sort}</span>
      <button type="button" onClick={() => onScopeChange("ALL")}>
        All filter
      </button>
      <button type="button" onClick={() => onScopeChange("YOURS")}>
        Yours filter
      </button>
      <button type="button" onClick={() => onSortChange("OLDEST")}>
        Oldest sort
      </button>
      <button type="button" onClick={() => onSortChange("NEWEST")}>
        Newest sort
      </button>
    </div>
  ),
}));

vi.mock("./IssueActivityTimeline", () => ({
  IssueActivityTimeline: (props: {
    items: Array<{ id: number }>;
    sort: "NEWEST" | "OLDEST";
    scrollToItemId?: number | null;
    newMessageMarkerId?: number | null;
    onScrollToItemDone?: (itemId: number) => void;
    onLatestEdgeChange?: (isAtLatestEdge: boolean) => void;
    onNewMessageMarkerVisibilityChange?: (isVisible: boolean) => void;
  }) => {
    timelineState.props = props;
    const renderedMarkerId =
      props.newMessageMarkerId != null && props.items.some((item) => item.id === props.newMessageMarkerId)
        ? props.newMessageMarkerId
        : "none";

    return (
      <div data-testid="timeline-rendered">
        <div data-testid="timeline-item-ids">{props.items.map((item) => item.id).join(",")}</div>
        <div data-testid="timeline-scroll-target">{String(props.scrollToItemId ?? "none")}</div>
        <div data-testid="timeline-sort">{props.sort}</div>
        <div data-testid="timeline-marker-target">{String(renderedMarkerId)}</div>
        <button type="button" onClick={() => props.onLatestEdgeChange?.(true)}>
          Set latest edge true
        </button>
        <button type="button" onClick={() => props.onLatestEdgeChange?.(false)}>
          Set latest edge false
        </button>
        <button type="button" onClick={() => props.onNewMessageMarkerVisibilityChange?.(true)}>
          Set marker visible true
        </button>
        <button type="button" onClick={() => props.onNewMessageMarkerVisibilityChange?.(false)}>
          Set marker visible false
        </button>
        <button
          type="button"
          onClick={() => {
            if (props.scrollToItemId != null) {
              props.onScrollToItemDone?.(props.scrollToItemId);
            }
          }}
        >
          Complete scroll
        </button>
      </div>
    );
  },
}));

vi.mock("./IssueActivityRealtimeListener", () => ({
  IssueActivityRealtimeListener: (props: {
    issueId: number;
    latestUpdateId?: number;
    onUpdate: (update: IssueUpdate) => void;
  }) => {
    realtimeListenerState.props = props;
    return <div data-testid="realtime-listener" />;
  },
}));

function buildUpdate(updateId: number, actorId = 1, message = `message-${updateId}`): IssueUpdate {
  return {
    updateId,
    issueId: 77,
    actorId,
    actorUsername: actorId === 1 ? "alice" : "bob",
    eventType: "COMMENT",
    at: `2026-03-15T10:${String(updateId).padStart(2, "0")}:00Z`,
    message,
    attachments: [],
  };
}

const currentUser: AuthUser = {
  userId: 1,
  username: "alice",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Doe",
  isAdmin: false,
  profileImg: "",
  active: true,
};

async function renderPanel(initialUpdates: IssueUpdate[] = [buildUpdate(1)]) {
  listIssueUpdatesApiMock.mockResolvedValue(initialUpdates);
  createIssueUpdateApiMock.mockReset();

  renderWithProviders(
    <IssueActivityPanel
      issueId={77}
      issueTitle="Realtime issue"
      currentUser={currentUser}
      canCompose
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId("timeline-rendered")).toBeInTheDocument();
  });
}

async function emitRealtime(update: IssueUpdate) {
  await act(async () => {
    (realtimeListenerState.props as { onUpdate: (nextUpdate: IssueUpdate) => void }).onUpdate(update);
  });
}

describe("IssueActivityPanel", () => {
  beforeEach(() => {
    createIssueUpdateApiMock.mockReset();
    listIssueUpdatesApiMock.mockReset();
    timelineState.props = null;
    realtimeListenerState.props = null;
    vi.useRealTimers();
  });

  it("auto-scrolls to a new realtime update when the user is already at the latest edge", async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Set latest edge true" }));
    await emitRealtime(buildUpdate(10, 2, "ciao"));

    await waitFor(() => {
      expect(screen.getByTestId("timeline-scroll-target")).toHaveTextContent("10");
      expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("10");
    });
    expect(screen.queryByRole("button", { name: "New message: 1" })).not.toBeInTheDocument();
  });

  it("accumulates the badge count and jumps to the first new message when clicked", async () => {
    await renderPanel();

    await emitRealtime(buildUpdate(10, 2, "ciao"));
    await emitRealtime(buildUpdate(11, 2, "hey"));
    await emitRealtime(buildUpdate(12, 2, "Hello!"));

    const badge = await screen.findByRole("button", { name: "New message: 3" });
    expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("10");
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.getByTestId("timeline-scroll-target")).toHaveTextContent("10");
      expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("10");
    });
    expect(screen.queryByRole("button", { name: "New message: 3" })).not.toBeInTheDocument();
  });

  it("switches from YOURS to ALL before jumping to hidden pending updates", async () => {
    await renderPanel([buildUpdate(1, 1, "mine")]);

    fireEvent.click(screen.getByRole("button", { name: "Yours filter" }));
    await waitFor(() => {
      expect(screen.getByTestId("scope-value")).toHaveTextContent("YOURS");
    });

    await emitRealtime(buildUpdate(20, 2, "hidden while yours"));

    const badge = await screen.findByRole("button", { name: "New message: 1" });
    expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("none");
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.getByTestId("scope-value")).toHaveTextContent("ALL");
      expect(screen.getByTestId("timeline-scroll-target")).toHaveTextContent("20");
      expect(screen.getByTestId("timeline-item-ids")).toHaveTextContent("20");
      expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("20");
    });
  });

  it("clears pending updates when the user manually reaches the latest edge", async () => {
    await renderPanel();

    await emitRealtime(buildUpdate(10, 2, "ciao"));
    expect(await screen.findByRole("button", { name: "New message: 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Set latest edge true" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "New message: 1" })).not.toBeInTheDocument();
    });
  });

  it("does not create a new pending badge for duplicate SSE echoes", async () => {
    const duplicatedUpdate = buildUpdate(10, 2, "already cached");
    await renderPanel([duplicatedUpdate]);

    await emitRealtime(duplicatedUpdate);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "New message: 1" })).not.toBeInTheDocument();
      expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("none");
    });
  });

  it("does not show the new-message badge for updates authored by the current user", async () => {
    await renderPanel();

    await emitRealtime(buildUpdate(30, 1, "my own message"));

    await waitFor(() => {
      expect(screen.getByTestId("timeline-scroll-target")).toHaveTextContent("30");
      expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("none");
    });
    expect(screen.queryByRole("button", { name: "New message: 1" })).not.toBeInTheDocument();
  });

  it("keeps the inline marker after clicking the badge and removes it after 3 seconds of cumulative visibility", async () => {
    await renderPanel();

    await emitRealtime(buildUpdate(10, 2, "ciao"));
    await emitRealtime(buildUpdate(11, 2, "hey"));

    const badge = await screen.findByRole("button", { name: "New message: 2" });
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "New message: 2" })).not.toBeInTheDocument();
      expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("10");
    });

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Set marker visible true" }));

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("10");

    fireEvent.click(screen.getByRole("button", { name: "Set marker visible false" }));

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("10");

    fireEvent.click(screen.getByRole("button", { name: "Set marker visible true" }));

    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("10");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("timeline-marker-target")).toHaveTextContent("none");
  });
});
