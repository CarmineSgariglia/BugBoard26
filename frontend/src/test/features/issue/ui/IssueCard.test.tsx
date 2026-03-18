import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IssueCard } from "../../../../features/issue/ui/IssueCard";

describe("IssueCard", () => {
  const dummyIssue = {
    issueId: 42,
    title: "Breakage in login",
    description: "The login button crashes the app.",
    status: "TODO",
    priority: "HIGH",
    type: "BUG",
    projectId: 1,
    createdAt: "2026-03-10T10:00:00Z",
    tags: [{ tagId: 1, name: "frontend" }],
  } as any;

  it("renders issue details correctly", () => {
    render(<IssueCard issue={dummyIssue} />);

    // Check title and ID
    expect(screen.getByText("#42 - Breakage in login")).toBeInTheDocument();
    // Check description
    expect(screen.getByText("The login button crashes the app.")).toBeInTheDocument();
    // Check status badge
    expect(screen.getByText("TODO")).toBeInTheDocument();
    // Check tag
    expect(screen.getByText("#FRONTEND")).toBeInTheDocument();
    // Check type tag
    expect(screen.getByText("BUG")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<IssueCard issue={dummyIssue} onClick={onClick} />);

    // Grabbing the top-level container by its content roughly, or just click the description
    const description = screen.getByText("The login button crashes the app.");
    fireEvent.click(description); // Bubbles up to container onClick

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies accurate status colors", () => {
    const doneIssue = { ...dummyIssue, status: "DONE" };
    render(<IssueCard issue={doneIssue} />);

    // DONE maps to text-emerald-500 usually
    const badge = screen.getByText("DONE");
    expect(badge.className).toContain("text-emerald-500");
  });
});
