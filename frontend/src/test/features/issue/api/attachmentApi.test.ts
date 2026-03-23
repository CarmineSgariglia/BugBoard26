import { describe, expect, it, vi, beforeEach } from "vitest";
import apiClient from "@shared/api/core/client";
import {
  uploadAttachmentApi,
  listAttachmentsApi,
  deleteAttachmentApi,
} from "@features/issue/api/attachmentApi";

vi.mock("@shared/api/core/client", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedClient = vi.mocked(apiClient) as any;

describe("attachmentApi", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("uploadAttachmentApi", () => {
    it("POSTs to /attachments with issueId in FormData", async () => {
      const fakeAttachment = { attachmentId: 1, url: "/files/test.png" };
      mockedClient.post.mockResolvedValue({ data: fakeAttachment });

      const file = new File(["content"], "test.png", { type: "image/png" });
      const result = await uploadAttachmentApi(file, { issueId: 42 });

      expect(mockedClient.post).toHaveBeenCalledWith(
        "/attachments",
        expect.any(FormData)
      );
      expect(result).toEqual(fakeAttachment);

      // Verify FormData contains the right fields
      const formData = mockedClient.post.mock.calls[0][1] as FormData;
      expect(formData.get("issueId")).toBe("42");
      expect(formData.get("file")).toBe(file);
    });

    it("POSTs to /attachments with updateId in FormData", async () => {
      mockedClient.post.mockResolvedValue({ data: {} });
      const file = new File(["x"], "x.txt", { type: "text/plain" });
      await uploadAttachmentApi(file, { updateId: 99 });

      const formData = mockedClient.post.mock.calls[0][1] as FormData;
      expect(formData.get("updateId")).toBe("99");
      expect(formData.get("issueId")).toBeNull();
    });

    it("includes message in FormData when provided", async () => {
      mockedClient.post.mockResolvedValue({ data: {} });
      const file = new File(["x"], "x.txt");
      await uploadAttachmentApi(file, { issueId: 1 }, "my message");

      const formData = mockedClient.post.mock.calls[0][1] as FormData;
      expect(formData.get("message")).toBe("my message");
    });

    it("does not include message when not provided", async () => {
      mockedClient.post.mockResolvedValue({ data: {} });
      const file = new File(["x"], "x.txt");
      await uploadAttachmentApi(file, { issueId: 1 });

      const formData = mockedClient.post.mock.calls[0][1] as FormData;
      expect(formData.get("message")).toBeNull();
    });
  });

  describe("listAttachmentsApi", () => {
    it("GETs /attachments with issueId param", async () => {
      const list = [{ attachmentId: 1 }, { attachmentId: 2 }];
      mockedClient.get.mockResolvedValue({ data: list });

      const result = await listAttachmentsApi({ issueId: 5 });

      expect(mockedClient.get).toHaveBeenCalledWith("/attachments", {
        params: { issueId: 5 },
      });
      expect(result).toEqual(list);
    });

    it("GETs /attachments with updateId param", async () => {
      mockedClient.get.mockResolvedValue({ data: [] });
      await listAttachmentsApi({ updateId: 10 });
      expect(mockedClient.get).toHaveBeenCalledWith("/attachments", {
        params: { updateId: 10 },
      });
    });
  });

  describe("deleteAttachmentApi", () => {
    it("DELETEs /attachments/:id", async () => {
      mockedClient.delete.mockResolvedValue({});
      await deleteAttachmentApi(7);
      expect(mockedClient.delete).toHaveBeenCalledWith("/attachments/7");
    });
  });
});
