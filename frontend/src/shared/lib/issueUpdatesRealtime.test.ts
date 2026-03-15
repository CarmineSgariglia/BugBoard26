import { describe, expect, it } from "vitest";

import type { IssueUpdate } from "../api/types/issues";
import { getLatestIssueUpdateId, upsertIssueUpdates } from "./issueUpdatesRealtime";

describe("issueUpdatesRealtime helpers", () => {
  it("upserts updates by updateId and keeps descending order", () => {
    const first: IssueUpdate = {
      updateId: 4,
      issueId: 9,
      actorId: 1,
      actorUsername: "alice",
      eventType: "COMMENT",
      at: "2026-03-15T10:00:00Z",
      message: "First",
      attachments: [],
    };
    const second: IssueUpdate = {
      updateId: 7,
      issueId: 9,
      actorId: 2,
      actorUsername: "bob",
      eventType: "STATUS_CHANGE",
      at: "2026-03-15T10:05:00Z",
      message: "Done",
      oldStatus: "TODO",
      newStatus: "DONE",
      attachments: [],
    };
    const updatedFirst: IssueUpdate = {
      ...first,
      attachments: [
        {
          attachmentId: 3,
          updateId: 4,
          originalName: "proof.png",
          path: "issue-attachments/9/proof.png",
          url: "https://example.com/proof.png",
          mimeType: "image/png",
          size: 1200,
          uploadedAt: "2026-03-15T10:01:00Z",
        },
      ],
    };

    expect(upsertIssueUpdates([first], [second, updatedFirst])).toEqual([second, updatedFirst]);
    expect(getLatestIssueUpdateId([first, second])).toBe(7);
  });
});
