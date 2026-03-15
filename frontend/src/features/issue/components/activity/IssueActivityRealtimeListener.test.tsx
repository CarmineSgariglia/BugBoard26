import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IssueUpdate } from "@shared/api/types/issues";
import { IssueActivityRealtimeListener } from "./IssueActivityRealtimeListener";

const {
  refreshUserMock,
  getAccessTokenMock,
  refreshApiMock,
} = vi.hoisted(() => ({
  refreshUserMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  refreshApiMock: vi.fn(),
}));

vi.mock("@shared/providers/AuthContext", () => ({
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

vi.mock("@shared/api/modules/auth", () => ({
  refreshApi: refreshApiMock,
}));

vi.mock("@shared/api/modules/issues", () => ({
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

  it("upserts issue updates from SSE without duplicating existing optimistic entries", async () => {
    const issueId = 42;
    const existingUpdate: IssueUpdate = {
      updateId: 8,
      issueId,
      actorId: 1,
      actorUsername: "alice",
      eventType: "COMMENT",
      at: "2026-03-15T10:00:00Z",
      message: "Local optimistic comment",
      attachments: [],
    };
    const streamedUpdate: IssueUpdate = {
      ...existingUpdate,
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

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    queryClient.setQueryData<IssueUpdate[]>(["issue", issueId, "updates"], [existingUpdate]);

    render(
      <QueryClientProvider client={queryClient}>
        <IssueActivityRealtimeListener issueId={issueId} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(queryClient.getQueryData<IssueUpdate[]>(["issue", issueId, "updates"])).toEqual([
        streamedUpdate,
      ]);
    });
  });
});
