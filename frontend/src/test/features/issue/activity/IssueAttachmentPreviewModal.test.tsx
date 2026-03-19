import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IssueAttachment } from "@shared/api/types/issues";
import { IssueAttachmentPreviewModal } from "@features/issue/activity/IssueAttachmentPreviewModal";
import { renderWithProviders } from "../../../render";

vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
}));

vi.mock("@shared/api/core/media", () => ({
  resolveMediaUrl: (url: string) => url || "",
}));

vi.mock("@shared/lib/media", () => ({
  getAttachmentDisplayName: (attachment: { filename?: string; originalName?: string }) =>
    attachment.filename ?? attachment.originalName ?? "file",
  getAttachmentPreviewKind: (attachment: { mimeType?: string }) => {
    if (attachment.mimeType?.startsWith("image/")) return "image";
    if (attachment.mimeType?.startsWith("video/")) return "video";
    if (attachment.mimeType === "application/pdf") return "pdf";
    if (attachment.mimeType?.startsWith("text/")) return "text";
    return "unsupported";
  },
}));

const originalFetch = global.fetch;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

const makeAttachment = (overrides: Partial<IssueAttachment> = {}): IssueAttachment =>
  ({
    attachmentId: 1,
    updateId: 1,
    originalName: "test.png",
    path: "/files/test.png",
    url: "/files/test.png",
    mimeType: "image/png",
    size: 1024,
    uploadedAt: "2026-03-18T10:00:00Z",
    ...overrides,
  }) as IssueAttachment;

describe("IssueAttachmentPreviewModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:preview-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it("renders nothing when attachment is null", () => {
    renderWithProviders(<IssueAttachmentPreviewModal attachment={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();
  });

  it("renders the header, mime type and download link", () => {
    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ originalName: "photo.png", url: "/files/photo.png" })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getByText("image/png")).toBeInTheDocument();
    expect(screen.getByText("Download").closest("a")).toHaveAttribute("href", "/files/photo.png");
  });

  it("renders image and video previews for supported attachments", () => {
    const { rerender, container } = renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "image/png", url: "/img.png" })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute("src", "/img.png");

    rerender(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "video/mp4", url: "/video.mp4" })}
        onClose={vi.fn()}
      />,
    );

    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "/video.mp4");
  });

  it("loads text previews with same-origin credentials", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "Hello, world!",
    } as Response);

    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "text/plain", url: "/file.txt" })}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Hello, world!")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/file.txt",
      expect.objectContaining({
        credentials: "include",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("shows a fallback link when text preview loading fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "text/plain", url: "/broken.txt" })}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Unable to load preview for this file.")).toBeInTheDocument();
    });

    expect(screen.getByText("Open file").closest("a")).toHaveAttribute("href", "/broken.txt");
  });

  it("loads PDF previews as blob URLs and revokes them on unmount", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
    } as Response);

    const { unmount } = renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "application/pdf", url: "/doc.pdf" })}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTitle("Preview of test.png")).toHaveAttribute("src", "blob:preview-url");
    });

    unmount();

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-url");
  });

  it("shows a fallback link when PDF preview loading fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({ mimeType: "application/pdf", url: "/denied.pdf" })}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Unable to load PDF preview.")).toBeInTheDocument();
    });

    expect(screen.getByText("Open file").closest("a")).toHaveAttribute("href", "/denied.pdf");
  });

  it("omits credentials for cross-origin preview fetches", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "remote text",
    } as Response);

    renderWithProviders(
      <IssueAttachmentPreviewModal
        attachment={makeAttachment({
          mimeType: "text/plain",
          url: "https://cdn.example.com/file.txt",
        })}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("remote text")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/file.txt",
      expect.objectContaining({
        credentials: "omit",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <IssueAttachmentPreviewModal attachment={makeAttachment()} onClose={onClose} />,
    );

    await user.click(screen.getByLabelText("Close preview"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
