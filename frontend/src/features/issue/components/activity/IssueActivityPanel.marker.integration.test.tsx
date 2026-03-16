import { forwardRef } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@shared/api/types/auth";
import type { IssueUpdate } from "@shared/api/types/issues";
import { renderWithProviders } from "../../../../test/render";
import { IssueActivityPanel } from "./IssueActivityPanel";

const {
  createIssueUpdateApiMock,
  listIssueUpdatesApiMock,
  realtimeListenerState,
} = vi.hoisted(() => ({
  createIssueUpdateApiMock: vi.fn(),
  listIssueUpdatesApiMock: vi.fn(),
  realtimeListenerState: { props: null as null | Record<string, unknown> },
}));

vi.mock("@shared/api/modules/issues", () => ({
  createIssueUpdateApi: createIssueUpdateApiMock,
  listIssueUpdatesApi: listIssueUpdatesApiMock,
}));

vi.mock("./IssueActivityRealtimeListener", () => ({
  IssueActivityRealtimeListener: (props: {
    issueId: number;
    latestUpdateId?: number;
    onUpdate: (update: IssueUpdate) => void;
  }) => {
    realtimeListenerState.props = props;
    return null;
  },
}));

vi.mock("./IssueActivityItem", () => ({
  IssueActivityItem: forwardRef<
    HTMLDivElement,
    { item: { title: string; message: string; id: number }; showNewMessageMarker?: boolean }
  >(({ item, showNewMessageMarker = false }, ref) => (
    <div>
      {showNewMessageMarker ? (
        <div ref={ref} data-activity-marker-id={item.id} data-testid="issue-activity-new-message-marker">
          <span data-testid="issue-activity-new-message-marker-line-left" />
          <span data-testid="issue-activity-new-message-marker-label">NEW MESSAGE</span>
          <span data-testid="issue-activity-new-message-marker-line-right" />
        </div>
      ) : null}
      <div>{item.title}</div>
      <div>{item.message}</div>
    </div>
  )),
}));

function buildUpdate(updateId: number, actorId = 2, message = `message-${updateId}`): IssueUpdate {
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

const adminUser: AuthUser = {
  ...currentUser,
  userId: 99,
  username: "admin-user",
  email: "admin@example.com",
  isAdmin: true,
};

async function emitRealtime(update: IssueUpdate) {
  await act(async () => {
    (realtimeListenerState.props as { onUpdate: (nextUpdate: IssueUpdate) => void }).onUpdate(update);
  });
}

describe("IssueActivityPanel marker integration", () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    createIssueUpdateApiMock.mockReset();
    listIssueUpdatesApiMock.mockReset().mockResolvedValue([buildUpdate(1, 2, "existing message")]);
    realtimeListenerState.props = null;
    scrollIntoViewMock.mockReset();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    globalThis.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
      root: null,
      rootMargin: "",
      thresholds: [0],
      takeRecords: () => [],
    })) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
    vi.restoreAllMocks();
  });

  it("renders the real New message marker in the chat after a realtime update arrives", async () => {
    renderWithProviders(
      <IssueActivityPanel
        issueId={77}
        issueTitle="Realtime issue"
        currentUser={currentUser}
        canCompose={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("existing message")).toBeInTheDocument();
    });

    await emitRealtime(buildUpdate(10, 2, "ciao"));

    await waitFor(() => {
      expect(screen.getByTestId("issue-activity-new-message-marker")).toBeInTheDocument();
      expect(screen.getByTestId("issue-activity-new-message-marker-label")).toHaveTextContent("NEW MESSAGE");
      expect(screen.getByTestId("issue-activity-new-message-marker-line-left")).toBeInTheDocument();
      expect(screen.getByTestId("issue-activity-new-message-marker-line-right")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New message: 1" })).toBeInTheDocument();
    });
  });

  it("keeps the real inline marker visible after clicking the badge jump", async () => {
    renderWithProviders(
      <IssueActivityPanel
        issueId={77}
        issueTitle="Realtime issue"
        currentUser={currentUser}
        canCompose={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("existing message")).toBeInTheDocument();
    });

    await emitRealtime(buildUpdate(10, 2, "ciao"));
    await emitRealtime(buildUpdate(11, 2, "hey"));

    const badge = await screen.findByRole("button", { name: "New message: 2" });
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "New message: 2" })).not.toBeInTheDocument();
      expect(screen.getByTestId("issue-activity-new-message-marker")).toBeInTheDocument();
      expect(screen.getByTestId("issue-activity-new-message-marker-label")).toHaveTextContent("NEW MESSAGE");
    });
  });

  it("renders the real inline marker for admins when the badge appears", async () => {
    renderWithProviders(
      <IssueActivityPanel
        issueId={77}
        issueTitle="Realtime issue"
        currentUser={adminUser}
        canCompose
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("existing message")).toBeInTheDocument();
    });

    await emitRealtime(buildUpdate(10, 2, "ciao"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New message: 1" })).toBeInTheDocument();
      expect(screen.getByTestId("issue-activity-new-message-marker")).toBeInTheDocument();
      expect(screen.getByTestId("issue-activity-new-message-marker-label")).toHaveTextContent("NEW MESSAGE");
    });
  });
});
