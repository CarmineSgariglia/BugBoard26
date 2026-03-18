import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IssueAttachmentPreviewModal } from "@features/issue/activity/IssueAttachmentPreviewModal";
import { renderWithProviders } from "../../../render";
import type { IssueAttachment } from "@shared/api/types/issues";

// Mock ModalOverlay
vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({
    children,
    isOpen,
    onClose,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="modal-overlay">
        {children}
        <button onClick={onClose} aria-label="Close modal">
          ×
        </button>
      </div>
    ) : null,
}));

// Mock resolveMediaUrl
vi.mock("@shared/api/core/media", () => ({
  resolveMediaUrl: (url: string) => url || "",
}));

// Mock media lib helpers
vi.mock("@shared/lib/media", () => ({
  getAttachmentDisplayName: (a: { filename?: string }) => a.filename ?? "file",
  getAttachmentPreviewKind: (a: { mimeType?: string }) => {
    if (a.mimeType?.startsWith("image/")) return "image";
    if (a.mimeType?.startsWith("video/")) return "video";
    if (a.mimeType === "application/pdf") return "pdf";
    if (a.mimeType?.startsWith("text/")) return "text";
    return "unsupported";
  },
  formatBytes: (n: number) => `${n} B`,
  isAttachmentPreviewable: (a: { mimeType?: string }) =>
    !!(
      a.mimeType?.startsWith("image/") ||
      a.mimeType?.startsWith("video/") ||
      a.mimeType === "application/pdf" ||
      a.mimeType?.startsWith("text/")
    ),
}));

const makeAttachment = (overrides: Partial<IssueAttachment> = {}): IssueAttachment => ({
  attachmentId: 1,
  url: "/files/test.png",
  path: "/files/test.png",
  mimeType: "image/png",
  filename: "test.png",
  size: 1024,
  ...overrides,
} as IssueAttachment);

describe("IssueAttachmentPreviewModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when attachment is null", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal attachment={null} onClose={vi.fn()} />
    );
    expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();
  });

  it("renders modal when attachment is provided", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId("modal-overlay")).toBeInTheDocument();
  });

  it("renders the attachment filename in the header", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ filename: "photo.png" })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("photo.png")).toBeInTheDocument();
  });

  it("renders the mimeType in the header", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "image/png" })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("image/png")).toBeInTheDocument();
  });

  it("shows an img element for image attachments", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "image/png", url: "/img.png" })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/img.png");
  });

  it("shows a video element for video attachments", () => {
    const { container } = renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "video/mp4", url: "/vid.mp4" })}
        onClose={vi.fn()}
      />
    );
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "/vid.mp4");
  });

  it("shows 'Loading PDF preview...' for PDF attachments initially", () => {
    // PDF fetch is triggered but won't complete in sync — loading state shows
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({
          mimeType: "application/pdf",
          url: "/doc.pdf",
        })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Loading PDF preview...")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment()}
        onClose={onClose}
      />
    );
    await user.click(screen.getByLabelText("Close preview"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders a Download link with correct href", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ url: "/files/photo.png", filename: "photo.png" })}
        onClose={vi.fn()}
      />
    );
    const downloadLink = screen.getByText("Download").closest("a");
    expect(downloadLink).toHaveAttribute("href", "/files/photo.png");
  });

  it("shows 'Unknown file type' when mimeType is not provided", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: undefined })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Unknown file type")).toBeInTheDocument();
  });

  it("shows text content for text attachments", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "Hello, world!",
    } as Response);

    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({
          mimeType: "text/plain",
          url: "/file.txt",
        })}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Hello, world!")).toBeInTheDocument();
    });
  });
});
