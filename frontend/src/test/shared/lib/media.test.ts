import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_FILE_BYTES,
  ATTACHMENT_MAX_VIDEO_BYTES,
  formatBytes,
  getAttachmentDisplayName,
  getAttachmentKind,
  getAttachmentPreviewKind,
  isAttachmentPreviewable,
  prepareAttachmentUpload,
} from "../../../../src/shared/lib/media";

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

    it("trims originalName and falls back to unknown when everything is missing", () => {
      expect(getAttachmentDisplayName({ originalName: "  report.csv  " })).toBe("report.csv");
      expect(getAttachmentDisplayName({})).toBe("File #unknown");
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

    it("returns unsupported when neither mime nor extension is available", () => {
      expect(getAttachmentPreviewKind({})).toBe("unsupported");
    });
  });

  describe("isAttachmentPreviewable", () => {
    it("returns true only for previewable attachment kinds", () => {
      expect(isAttachmentPreviewable({ mimeType: "image/png" })).toBe(true);
      expect(isAttachmentPreviewable({ mimeType: "video/mp4" })).toBe(true);
      expect(isAttachmentPreviewable({ path: "guide.pdf" })).toBe(true);
      expect(isAttachmentPreviewable({ path: "app.log" })).toBe(true);
      expect(isAttachmentPreviewable({ path: "bundle.zip" })).toBe(false);
    });
  });

  describe("getAttachmentKind", () => {
    it("classifies files as image, video, file or unsupported", () => {
      expect(
        getAttachmentKind(new File(["img"], "photo.png", { type: "image/png" }))
      ).toBe("image");
      expect(
        getAttachmentKind(new File(["vid"], "clip.mov", { type: "video/quicktime" }))
      ).toBe("video");
      expect(
        getAttachmentKind(new File(["json"], "data.json", { type: "application/json" }))
      ).toBe("file");
      expect(
        getAttachmentKind(new File(["bin"], "archive.bin", { type: "application/octet-stream" }))
      ).toBe("unsupported");
    });
  });

  describe("prepareAttachmentUpload", () => {
    it("rejects unsupported files", async () => {
      await expect(
        prepareAttachmentUpload(
          new File(["bin"], "archive.bin", { type: "application/octet-stream" })
        )
      ).rejects.toThrow(
        "Supported files: images, MP4/WEBM/MOV videos, TXT/LOG/MD, CSV, JSON, PDF, ZIP."
      );
    });

    it("returns accepted non-media files unchanged when under the size limit", async () => {
      const file = new File(["hello"], "notes.txt", { type: "text/plain" });

      await expect(prepareAttachmentUpload(file)).resolves.toBe(file);
    });

    it("rejects large generic files and large videos", async () => {
      const oversizedFile = new File(["a"], "report.pdf", { type: "application/pdf" });
      Object.defineProperty(oversizedFile, "size", {
        configurable: true,
        value: ATTACHMENT_MAX_FILE_BYTES + 1,
      });

      const oversizedVideo = new File(["a"], "movie.mp4", { type: "video/mp4" });
      Object.defineProperty(oversizedVideo, "size", {
        configurable: true,
        value: ATTACHMENT_MAX_VIDEO_BYTES + 1,
      });

      await expect(prepareAttachmentUpload(oversizedFile)).rejects.toThrow(
        `Files must be at most ${formatBytes(ATTACHMENT_MAX_FILE_BYTES)}.`
      );
      await expect(prepareAttachmentUpload(oversizedVideo)).rejects.toThrow(
        `Videos must be at most ${formatBytes(ATTACHMENT_MAX_VIDEO_BYTES)}.`
      );
    });
  });
});
