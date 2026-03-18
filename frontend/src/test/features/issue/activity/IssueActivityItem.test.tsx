import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IssueActivityItem } from "@features/issue/activity/IssueActivityItem";
import { renderWithProviders } from "../../../render";
import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";

// Mock IssueAttachmentPreviewModal to avoid fetch / ModalOverlay complexity
vi.mock("@features/issue/activity/IssueAttachmentPreviewModal", () => ({
  IssueAttachmentPreviewModal: ({
    attachment,
    onClose,
  }: {
    attachment: { attachmentId: number; url: string } | null;
    onClose: () => void;
  }) =>
    attachment ? (
      <div data-testid="preview-modal">
        <button onClick={onClose}>Close preview</button>
      </div>
    ) : null,
}));

// Mock useAuth
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("@features/auth", () => ({ useAuth: useAuthMock }));

// Mock resolveMediaUrl to return a stable URL
vi.mock("@shared/api/core/media", () => ({
  resolveMediaUrl: (url: string) => url || "",
}));

const baseItem: UiActivityItem = {
  id: "1",
  actorId: 10,
  actorName: "alice",
  actorProfileImg: null,
  title: "alice commented",
  message: "This is a comment",
  isComment: true,
  attachments: [],
  at: "2026-01-15T12:00:00Z",
};

describe("IssueActivityItem", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { userId: 99, username: "bob" } });
    vi.useRealTimers();
  });

  it("renders the actor name", () => {
    renderWithProviders(<IssueActivityItem item={baseItem} />);
    expect(screen.getByText("alice commented")).toBeInTheDocument();
  });

  it("renders the comment message", () => {
    renderWithProviders(<IssueActivityItem item={baseItem} />);
    expect(screen.getByText("This is a comment")).toBeInTheDocument();
  });

  it("appends (you) when the actor is the current user and it's a comment", () => {
    useAuthMock.mockReturnValue({ user: { userId: 10, username: "alice" } });
    renderWithProviders(<IssueActivityItem item={baseItem} />);
    expect(screen.getByText("alice (you)")).toBeInTheDocument();
  });

  it("does not append (you) when the actor is a different user", () => {
    renderWithProviders(<IssueActivityItem item={baseItem} />);
    expect(screen.queryByText(/\(you\)/)).not.toBeInTheDocument();
  });

  it("shows the NEW MESSAGE marker when showNewMessageMarker is true", () => {
    renderWithProviders(
      <IssueActivityItem item={baseItem} showNewMessageMarker />
    );
    expect(
      screen.getByTestId("issue-activity-new-message-marker")
    ).toBeInTheDocument();
  });

  it("does not show the NEW MESSAGE marker by default", () => {
    renderWithProviders(<IssueActivityItem item={baseItem} />);
    expect(
      screen.queryByTestId("issue-activity-new-message-marker")
    ).not.toBeInTheDocument();
  });

  it("annotates non-comment activity titles with (you) for the current user", () => {
    useAuthMock.mockReturnValue({ user: { userId: 10, username: "alice" } });
    renderWithProviders(
      <IssueActivityItem
        item={{ ...baseItem, isComment: false, title: "alice changed the status" }}
      />
    );

    expect(screen.getByText("alice (you) changed the status")).toBeInTheDocument();
  });

  it("renders attachments with download link when present", () => {
    const itemWithAttachment: UiActivityItem = {
      ...baseItem,
      attachments: [
        {
          attachmentId: 5,
          url: "/files/doc.txt",
          path: "/files/doc.txt",
          mimeType: "text/plain",
          filename: "doc.txt",
          size: 1024,
        } as any,
      ],
    };
    renderWithProviders(<IssueActivityItem item={itemWithAttachment} />);
    expect(screen.getByTitle("Download")).toBeInTheDocument();
  });

  it("does not render a preview button for unsupported attachments", () => {
    const itemWithAttachment: UiActivityItem = {
      ...baseItem,
      attachments: [
        {
          attachmentId: 8,
          url: "/files/archive.zip",
          path: "/files/archive.zip",
          mimeType: "application/zip",
          filename: "archive.zip",
          size: 4096,
        } as any,
      ],
    };

    renderWithProviders(<IssueActivityItem item={itemWithAttachment} />);

    expect(screen.queryByTitle("Preview")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Download archive.zip")).toBeInTheDocument();
  });

  it("opens the preview modal when Preview is clicked on a previewable file", async () => {
    const user = userEvent.setup();
    const itemWithImage: UiActivityItem = {
      ...baseItem,
      attachments: [
        {
          attachmentId: 6,
          url: "/files/photo.png",
          path: "/files/photo.png",
          mimeType: "image/png",
          filename: "photo.png",
          size: 2048,
        } as any,
      ],
    };
    renderWithProviders(<IssueActivityItem item={itemWithImage} />);
    await user.click(screen.getByTitle("Preview"));
    expect(screen.getByTestId("preview-modal")).toBeInTheDocument();
  });

  it("closes the preview modal when Close preview is clicked", async () => {
    const user = userEvent.setup();
    const itemWithImage: UiActivityItem = {
      ...baseItem,
      attachments: [
        {
          attachmentId: 7,
          url: "/files/img.jpg",
          path: "/files/img.jpg",
          mimeType: "image/jpeg",
          filename: "img.jpg",
          size: 4096,
        } as any,
      ],
    };
    renderWithProviders(<IssueActivityItem item={itemWithImage} />);
    await user.click(screen.getByTitle("Preview"));
    await user.click(screen.getByText("Close preview"));
    expect(screen.queryByTestId("preview-modal")).not.toBeInTheDocument();
  });

  it("renders the marker with the current activity id for timeline targeting", () => {
    renderWithProviders(
      <IssueActivityItem item={baseItem} showNewMessageMarker />
    );

    expect(screen.getByTestId("issue-activity-new-message-marker")).toHaveAttribute(
      "data-activity-marker-id",
      "1"
    );
  });
});
