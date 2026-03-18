import { formatIssueActivityEvent } from "@features/issue/lib/formatIssueActivityEvent";

const baseEvent = {
  updateId: 10,
  issueId: 5,
  actorId: 7,
  actorUsername: "dev",
  actorProfileImg: null,
  at: "2026-03-13T10:00:00Z",
  message: "",
  attachments: [],
};

describe("formatIssueActivityEvent", () => {
  it("formats comment events as comments with the actor name as title", () => {
    const formatted = formatIssueActivityEvent({
      ...baseEvent,
      eventType: "COMMENT",
      message: "Working on it",
    });

    expect(formatted.isComment).toBe(true);
    expect(formatted.title).toBe("dev");
    expect(formatted.message).toBe("Working on it");
  });

  it("formats status change events with the proper title and fallback message", () => {
    const formatted = formatIssueActivityEvent({
      ...baseEvent,
      eventType: "STATUS_CHANGE",
      message: "",
    });

    expect(formatted.isComment).toBe(false);
    expect(formatted.title).toBe("dev changed status");
    expect(formatted.message).toBe("Issue updated");
  });

  it("formats assign events with the member-specific title", () => {
    const formatted = formatIssueActivityEvent({
      ...baseEvent,
      eventType: "ASSIGN",
      message: "Assigned to Alex",
    });

    expect(formatted.title).toBe("dev added member(s)");
    expect(formatted.message).toBe("Assigned to Alex");
  });
});
