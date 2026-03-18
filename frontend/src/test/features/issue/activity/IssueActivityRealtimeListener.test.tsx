import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IssueUpdate } from "@shared/api/types/issues";
import { IssueActivityRealtimeListener } from "@features/issue/activity/IssueActivityRealtimeListener";

const {
  refreshUserMock,
  getAccessTokenMock,
  refreshApiMock,
} = vi.hoisted(() => ({
  refreshUserMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  refreshApiMock: vi.fn(),
}));

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    user: {
      userId: 1,
      username: "issue-stream-user",
      email: "issue-stream@example.com",
      firstName: "Issue",
      lastName: "Stream",
      isAdmin: false,
      profileImg: null,
      active: true,
    },
    refreshUser: refreshUserMock,
    isLoading: false,
  }),
}));

vi.mock("@shared/api/core/client", () => ({
  getAccessToken: getAccessTokenMock,
}));

vi.mock("@features/auth/api", () => ({
  refreshApi: refreshApiMock,
}));

vi.mock("@features/issue/api", () => ({
  getIssueUpdatesStreamUrl: (issueId: number) => `/api/issues/${issueId}/updates/stream`,
}));

describe("IssueActivityRealtimeListener", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    refreshUserMock.mockReset();
    getAccessTokenMock.mockReset().mockReturnValue("test-token");
    refreshApiMock.mockReset().mockResolvedValue("test-token");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("forwards realtime issue updates and sends the last known event id", async () => {
    const issueId = 42;
    const streamedUpdate: IssueUpdate = {
      updateId: 8,
      issueId,
      actorId: 1,
      actorUsername: "alice",
      eventType: "COMMENT",
      at: "2026-03-15T10:00:00Z",
      message: "Local optimistic comment",
      attachments: [
        {
          attachmentId: 15,
          updateId: 8,
          originalName: "proof.png",
          path: "issue-attachments/42/proof.png",
          url: "https://example.com/proof.png",
          mimeType: "image/png",
          size: 1200,
          uploadedAt: "2026-03-15T10:00:02Z",
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((_input) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `id: ${streamedUpdate.updateId}\nevent: issue.event.created\ndata: ${JSON.stringify(streamedUpdate)}\n\n`,
            ),
          );
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
        }),
      );
    });

    const onUpdate = vi.fn();

    render(<IssueActivityRealtimeListener issueId={issueId} latestUpdateId={7} onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(streamedUpdate);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/issues/42/updates/stream", expect.objectContaining({
      method: "GET",
      credentials: "include",
      headers: expect.any(Headers),
    }));

    const fetchMock = global.fetch as unknown as {
      mock: { calls: Array<[string, { headers: Headers }]> };
    };
    const fetchOptions = fetchMock.mock.calls[0]?.[1] as {
      headers: Headers;
    };
    expect(fetchOptions.headers.get("Last-Event-ID")).toBe("7");
  });
});
