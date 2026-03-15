import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignIssueUsersApi,
  createIssueUpdateApi,
  getIssueApi,
  getIssueUpdatesStreamUrl,
  listIssueSuggestionsApi,
  listIssueUpdatesApi,
  unassignIssueUsersApi,
  updateIssueApi,
  updateIssueDetailsApi,
} from "./issues";

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
  apiBaseUrl: "/api",
}));

describe("issues api module", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  it("builds the issue stream URL from the shared api base url", () => {
    expect(getIssueUpdatesStreamUrl(44)).toBe("/api/issues/44/updates/stream");
  });

  it("creates issue updates as JSON when there are no files", async () => {
    const payload = { updateId: 1, message: "hello" };
    postMock.mockResolvedValue({ data: payload });

    await expect(createIssueUpdateApi(4, { message: "hello" })).resolves.toEqual(payload);
    expect(postMock).toHaveBeenCalledWith("/issues/4/updates", { message: "hello" });
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

  it("wraps the remaining issue endpoints consistently", async () => {
    patchMock
      .mockResolvedValueOnce({ data: { issueId: 6, title: "details" } })
      .mockResolvedValueOnce({ data: { issueId: 6, title: "patched" } });
    getMock
      .mockResolvedValueOnce({ data: { issueId: 6 } })
      .mockResolvedValueOnce({ data: [{ updateId: 1 }] })
      .mockResolvedValueOnce({ data: [{ userId: 9 }] });
    postMock
      .mockResolvedValueOnce({ data: { detail: "assigned" } })
      .mockResolvedValueOnce({ data: { detail: "unassigned" } });

    await expect(updateIssueDetailsApi(6, { title: "details" })).resolves.toEqual({
      issueId: 6,
      title: "details",
    });
    await expect(updateIssueApi(6, { title: "patched" })).resolves.toEqual({
      issueId: 6,
      title: "patched",
    });
    await expect(getIssueApi(6)).resolves.toEqual({ issueId: 6 });
    await expect(listIssueUpdatesApi(6)).resolves.toEqual([{ updateId: 1 }]);
    await expect(assignIssueUsersApi(6, [1, 2])).resolves.toEqual({ detail: "assigned" });
    await expect(unassignIssueUsersApi(6, [1])).resolves.toEqual({ detail: "unassigned" });
    await expect(listIssueSuggestionsApi(6)).resolves.toEqual([{ userId: 9 }]);

    expect(patchMock).toHaveBeenNthCalledWith(1, "/issues/6/details", { title: "details" });
    expect(patchMock).toHaveBeenNthCalledWith(2, "/issues/6", { title: "patched" });
    expect(getMock).toHaveBeenNthCalledWith(1, "/issues/6");
    expect(getMock).toHaveBeenNthCalledWith(2, "/issues/6/updates");
    expect(postMock).toHaveBeenNthCalledWith(1, "/issues/6/assign", { userIds: [1, 2] });
    expect(postMock).toHaveBeenNthCalledWith(2, "/issues/6/unassign", { userIds: [1] });
    expect(getMock).toHaveBeenNthCalledWith(3, "/issues/6/suggestions");
  });
});
