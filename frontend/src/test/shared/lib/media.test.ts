import { describe, expect, it } from "vitest";
import { formatBytes, getAttachmentDisplayName, getAttachmentPreviewKind } from "../../../../src/shared/lib/media";

describe("media helpers", () => {
  describe("formatBytes", () => {
    it("formats bytes properly", () => {
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1048576)).toBe("1.0 MB");
      expect(formatBytes(10485760)).toBe("10 MB");
    });
  });

  describe("getAttachmentDisplayName", () => {
    it("returns originalName if provided", () => {
      expect(getAttachmentDisplayName({ originalName: "my_file.png" })).toBe("my_file.png");
    });

    it("falls back to path/url filename", () => {
      expect(getAttachmentDisplayName({ path: "/uploads/image.png?v=1" })).toBe("image.png");
      expect(getAttachmentDisplayName({ url: "https://example.com/file.pdf" })).toBe("file.pdf");
    });

    it("appends custom ID if fallback name is empty", () => {
      expect(getAttachmentDisplayName({ attachmentId: 5 })).toBe("File #5");
    });
  });

  describe("getAttachmentPreviewKind", () => {
    it("identifies image and video types", () => {
      expect(getAttachmentPreviewKind({ mimeType: "image/jpeg" })).toBe("image");
      expect(getAttachmentPreviewKind({ mimeType: "video/mp4" })).toBe("video");
      expect(getAttachmentPreviewKind({ url: "file.pdf" })).toBe("pdf");
    });
    
    it("identifies text for logs/md", () => {
      expect(getAttachmentPreviewKind({ path: "app.log" })).toBe("text");
      expect(getAttachmentPreviewKind({ url: "guide.md" })).toBe("text");
    });

    it("identifies standard attachment formats as file if not previewable", () => {
      expect(getAttachmentPreviewKind({ path: "bundle.zip" })).toBe("file");
    });
  });
});
