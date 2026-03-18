import { describe, expect, it } from "vitest";
import { buildIssueEditActivityMessage } from "@features/issue/lib/buildIssueEditActivityMessage";
import type { Issue } from "@shared/api/types/issues";

const baseIssue: Partial<Issue> = {
  title: "Original Title",
  description: "Original description",
  type: "BUG",
  status: "TODO",
  priority: "LOW",
  tags: [],
};

const baseAfter = {
  title: "Original Title",
  description: "Original description",
  type: "BUG",
  status: "TODO",
  priority: "LOW",
  tags: [],
};

describe("buildIssueEditActivityMessage", () => {
  it("returns 'Issue updated' when nothing changed", () => {
    const result = buildIssueEditActivityMessage(baseIssue as Issue, baseAfter);
    expect(result).toBe("Issue updated");
  });

  it("includes title change in the message", () => {
    const result = buildIssueEditActivityMessage(baseIssue as Issue, {
      ...baseAfter,
      title: "New Title",
    });
    expect(result).toContain('title "Original Title" -> "New Title"');
  });

  it("includes 'description updated' when description changes", () => {
    const result = buildIssueEditActivityMessage(baseIssue as Issue, {
      ...baseAfter,
      description: "New description",
    });
    expect(result).toContain("description updated");
  });

  it("includes type change in the message", () => {
    const result = buildIssueEditActivityMessage(baseIssue as Issue, {
      ...baseAfter,
      type: "FEATURE",
    });
    expect(result).toContain("type BUG -> FEATURE");
  });

  it("includes status change in the message", () => {
    const result = buildIssueEditActivityMessage(baseIssue as Issue, {
      ...baseAfter,
      status: "IN_PROGRESS",
    });
    expect(result).toContain("status TODO -> IN_PROGRESS");
  });

  it("includes priority change in the message", () => {
    const result = buildIssueEditActivityMessage(baseIssue as Issue, {
      ...baseAfter,
      priority: "HIGH",
    });
    expect(result).toContain("priority LOW -> HIGH");
  });

  it("includes tag changes in the message", () => {
    const issueWithTags = { ...baseIssue, tags: [{ name: "frontend", tagId: 1 }] } as Issue;
    const result = buildIssueEditActivityMessage(issueWithTags, {
      ...baseAfter,
      tags: ["backend"],
    });
    expect(result).toContain("tags [frontend] -> [backend]");
  });

  it("does not report tag change when tags are equal but in different order", () => {
    const issueWithTags = {
      ...baseIssue,
      tags: [{ name: "b", tagId: 1 }, { name: "a", tagId: 2 }],
    } as Issue;
    const result = buildIssueEditActivityMessage(issueWithTags, {
      ...baseAfter,
      tags: ["a", "b"],
    });
    expect(result).toBe("Issue updated");
  });

  it("accumulates multiple changes separated by semicolons", () => {
    const result = buildIssueEditActivityMessage(baseIssue as Issue, {
      ...baseAfter,
      title: "New Title",
      status: "DONE",
    });
    expect(result).toContain("title");
    expect(result).toContain("status");
    expect(result).toMatch(/Updated:/);
  });

  it("returns empty tag list notation when all tags removed", () => {
    const issueWithTags = {
      ...baseIssue,
      tags: [{ name: "frontend", tagId: 1 }],
    } as Issue;
    const result = buildIssueEditActivityMessage(issueWithTags, {
      ...baseAfter,
      tags: [],
    });
    expect(result).toContain("tags [frontend] -> []");
  });
});
