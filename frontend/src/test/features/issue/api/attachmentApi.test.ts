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
    it("POSTs to the issue attachments collection", async () => {
      const fakeAttachment = { attachmentId: 1, url: "/files/test.png" };
      mockedClient.post.mockResolvedValue({ data: fakeAttachment });

      const file = new File(["content"], "test.png", { type: "image/png" });
      const result = await uploadAttachmentApi(file, { issueId: 42 });

      expect(mockedClient.post).toHaveBeenCalledWith(
        "/issues/42/attachments",
        expect.any(FormData)
      );
      expect(result).toEqual(fakeAttachment);

      const formData = mockedClient.post.mock.calls[0][1] as FormData;
      expect(formData.get("file")).toBe(file);
    });

    it("POSTs to the issue event attachments collection", async () => {
      mockedClient.post.mockResolvedValue({ data: {} });
      const file = new File(["x"], "x.txt", { type: "text/plain" });
      await uploadAttachmentApi(file, { issueId: 42, eventId: 99 });

      expect(mockedClient.post).toHaveBeenCalledWith(
        "/issues/42/events/99/attachments",
        expect.any(FormData)
      );
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
    it("GETs the issue attachments collection", async () => {
      const list = [{ attachmentId: 1 }, { attachmentId: 2 }];
      mockedClient.get.mockResolvedValue({ data: list });

      const result = await listAttachmentsApi(5);

      expect(mockedClient.get).toHaveBeenCalledWith("/issues/5/attachments");
      expect(result).toEqual(list);
    });
  });

  describe("deleteAttachmentApi", () => {
    it("DELETEs /issues/:issueId/attachments/:id", async () => {
      mockedClient.delete.mockResolvedValue({});
      await deleteAttachmentApi(5, 7);
      expect(mockedClient.delete).toHaveBeenCalledWith("/issues/5/attachments/7");
    });
  });
});
