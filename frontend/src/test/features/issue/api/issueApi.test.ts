import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignIssueUsersApi,
  createIssueUpdateApi,
  getIssueApi,
  getIssueSubscriptionApi,
  getIssueUpdatesStreamUrl,
  listIssueSuggestionsApi,
  listIssueUpdatesApi,
  subscribeToIssueApi,
  unassignIssueUsersApi,
  unsubscribeFromIssueApi,
  updateIssueApi,
  updateIssueDetailsApi,
} from "@features/issue/api";

const { getMock, postMock, patchMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    put: putMock,
    delete: deleteMock,
  },
  apiBaseUrl: "/api",
}));

describe("feature issues api module", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  it("builds the issue stream URL from the shared api base url", () => {
    expect(getIssueUpdatesStreamUrl(44)).toBe("/api/issues/44/events/stream");
  });

  it("fetches an issue by id", async () => {
    getMock.mockResolvedValue({ data: { issueId: 6 } });

    await expect(getIssueApi(6)).resolves.toEqual({ issueId: 6 });
    expect(getMock).toHaveBeenCalledWith("/issues/6", {});
  });

  it("gets the current issue subscription state", async () => {
    getMock.mockResolvedValue({ data: { subscribed: false } });

    await expect(getIssueSubscriptionApi(6)).resolves.toEqual({ subscribed: false });
    expect(getMock).toHaveBeenCalledWith("/issues/6/subscriptions/me", {});
  });

  it("creates issue updates as JSON when there are no files", async () => {
    const payload = { updateId: 1, message: "hello" };
    postMock.mockResolvedValue({ data: payload });

    await expect(createIssueUpdateApi(4, { message: "hello" })).resolves.toEqual(payload);
    expect(postMock).toHaveBeenCalledWith("/issues/4/events", { message: "hello" });
  });

  it("creates issue updates as FormData when files are attached", async () => {
    const payload = { updateId: 2, message: "with file" };
    const file = new File(["hello"], "note.txt", { type: "text/plain" });
    postMock.mockResolvedValue({ data: payload });

    await expect(createIssueUpdateApi(5, { message: "with file", files: [file] })).resolves.toEqual(payload);

    const [, sentPayload] = postMock.mock.calls[0];
    expect(sentPayload).toBeInstanceOf(FormData);
    expect((sentPayload as FormData).get("message")).toBe("with file");
    expect((sentPayload as FormData).getAll("file")).toHaveLength(1);
  });

  it("creates issue updates with multiple files", async () => {
    const payload = { updateId: 3, message: "multiple file" };
    const file1 = new File(["hello"], "note1.txt", { type: "text/plain" });
    const file2 = new File(["world"], "note2.txt", { type: "text/plain" });
    postMock.mockResolvedValue({ data: payload });

    await expect(createIssueUpdateApi(5, { message: "multiple file", files: [file1, file2] })).resolves.toEqual(payload);

    const [, sentPayload] = postMock.mock.calls[0];
    expect(sentPayload).toBeInstanceOf(FormData);
    expect((sentPayload as FormData).getAll("file")).toHaveLength(2);
  });

  it("updates issue details", async () => {
    patchMock.mockResolvedValue({ data: { issueId: 6, title: "details" } });

    await expect(updateIssueDetailsApi(6, { title: "details" })).resolves.toEqual({
      issueId: 6,
      title: "details",
    });
    expect(patchMock).toHaveBeenCalledWith("/issues/6", { title: "details" });
  });

  it("updates issue basic fields", async () => {
    patchMock.mockResolvedValue({ data: { issueId: 6, title: "patched" } });

    await expect(updateIssueApi(6, { title: "patched" })).resolves.toEqual({
      issueId: 6,
      title: "patched",
    });
    expect(patchMock).toHaveBeenCalledWith("/issues/6", { title: "patched" });
  });

  it("lists issue updates", async () => {
    getMock.mockResolvedValue({ data: [{ updateId: 1 }] });

    await expect(listIssueUpdatesApi(6)).resolves.toEqual([{ updateId: 1 }]);
    expect(getMock).toHaveBeenCalledWith("/issues/6/events", {});
  });

  it("assigns users to an issue", async () => {
    putMock.mockResolvedValue({ data: undefined });

    await expect(assignIssueUsersApi(6, [1, 2])).resolves.toBeUndefined();
    expect(putMock).toHaveBeenNthCalledWith(1, "/issues/6/assignees/1");
    expect(putMock).toHaveBeenNthCalledWith(2, "/issues/6/assignees/2");
  });

  it("unassigns users from an issue", async () => {
    deleteMock.mockResolvedValue({ data: undefined });

    await expect(unassignIssueUsersApi(6, [1])).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith("/issues/6/assignees/1");
  });

  it("subscribes the current admin to an issue", async () => {
    putMock.mockResolvedValue({ data: {} });

    await expect(subscribeToIssueApi(6)).resolves.toBeUndefined();
    expect(putMock).toHaveBeenCalledWith("/issues/6/subscriptions/me");
  });

  it("unsubscribes the current admin from an issue", async () => {
    deleteMock.mockResolvedValue({ data: {} });

    await expect(unsubscribeFromIssueApi(6)).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith("/issues/6/subscriptions/me");
  });

  it("lists issue suggestions", async () => {
    getMock.mockResolvedValue({ data: [{ userId: 9 }] });

    await expect(listIssueSuggestionsApi(6)).resolves.toEqual([{ userId: 9 }]);
    expect(getMock).toHaveBeenCalledWith("/issues/6/suggestions", {});
  });

  it("passes AbortSignal to issue read requests", async () => {
    const controller = new AbortController();
    getMock.mockResolvedValue({ data: { issueId: 6 } });

    await getIssueApi(6, { signal: controller.signal });

    expect(getMock).toHaveBeenCalledWith("/issues/6", { signal: controller.signal });
  });

  it("propagates API errors", async () => {
    const error = new Error("Network Error");
    getMock.mockRejectedValue(error);

    await expect(listIssueSuggestionsApi(6)).rejects.toThrow(error);
  });
});
