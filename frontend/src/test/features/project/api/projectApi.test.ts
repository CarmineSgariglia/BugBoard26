import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listProjectsApi,
  getProjectApi,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  getProjectSubscriptionApi,
  listProjectMembersApi,
  listProjectIssuesApi,
  createProjectIssueApi,
  subscribeToProjectApi,
  unsubscribeFromProjectApi,
} from "@features/project/api/projectApi";

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
}));

describe("feature project api module", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  const dummyProject = {
    projectId: 1,
    name: "Test Project",
    description: "A test project",
    color: "#fff",
  };

  it("lists projects with optional search", async () => {
    getMock.mockResolvedValue({ data: [dummyProject] });

    await expect(listProjectsApi()).resolves.toEqual([dummyProject]);
    expect(getMock).toHaveBeenCalledWith("/projects", { params: undefined });

    await expect(listProjectsApi("search-query")).resolves.toEqual([dummyProject]);
    expect(getMock).toHaveBeenLastCalledWith("/projects", { params: { q: "search-query" } });
  });

  it("lists projects with empty search query", async () => {
    getMock.mockResolvedValue({ data: [{ projectId: 1, name: "Test Project", description: "A test project", color: "#fff" }] });

    await expect(listProjectsApi("")).resolves.toEqual([{ projectId: 1, name: "Test Project", description: "A test project", color: "#fff" }]);
    expect(getMock).toHaveBeenCalledWith("/projects", { params: undefined });
  });

  it("fetches a single project by id", async () => {
    getMock.mockResolvedValue({ data: dummyProject });

    await expect(getProjectApi(1)).resolves.toEqual(dummyProject);
    expect(getMock).toHaveBeenCalledWith("/projects/1", {});
  });

  it("creates a project with payload", async () => {
    const payload = { name: "New", description: "Desc", color: "#000", icon: "icon", team: [] };
    postMock.mockResolvedValue({ data: { ...dummyProject, ...payload } });

    await expect(createProjectApi(payload)).resolves.toEqual({ ...dummyProject, ...payload });
    expect(postMock).toHaveBeenCalledWith("/projects", payload);
  });

  it("updates a project with payload", async () => {
    const payload = { name: "Updated Name" };
    patchMock.mockResolvedValue({ data: { ...dummyProject, ...payload } });

    await expect(updateProjectApi(1, payload)).resolves.toEqual({ ...dummyProject, ...payload });
    expect(patchMock).toHaveBeenCalledWith("/projects/1", payload);
  });

  it("deletes a project", async () => {
    deleteMock.mockResolvedValue({ data: {} });

    await expect(deleteProjectApi(1)).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith("/projects/1");
  });

  it("lists project members", async () => {
    const dummyMembers = [{ userId: 1, role: "ADMIN" }];
    getMock.mockResolvedValue({ data: dummyMembers });

    await expect(listProjectMembersApi(1)).resolves.toEqual(dummyMembers);
    expect(getMock).toHaveBeenCalledWith("/projects/1/members", {});
  });

  it("gets the current project subscription state", async () => {
    const subscription = { subscribed: false };
    getMock.mockResolvedValue({ data: subscription });

    await expect(getProjectSubscriptionApi(1)).resolves.toEqual(subscription);
    expect(getMock).toHaveBeenCalledWith("/projects/1/subscriptions/me", {});
  });

  it("subscribes the current admin to a project", async () => {
    putMock.mockResolvedValue({ data: {} });

    await expect(subscribeToProjectApi(1)).resolves.toBeUndefined();
    expect(putMock).toHaveBeenCalledWith("/projects/1/subscriptions/me");
  });

  it("unsubscribes the current admin from a project", async () => {
    deleteMock.mockResolvedValue({ data: {} });

    await expect(unsubscribeFromProjectApi(1)).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith("/projects/1/subscriptions/me");
  });

  it("lists project issues", async () => {
    const dummyIssues = [{ issueId: 1, title: "Issue 1" }];
    getMock.mockResolvedValue({ data: dummyIssues });

    await expect(listProjectIssuesApi(1)).resolves.toEqual(dummyIssues);
    expect(getMock).toHaveBeenCalledWith("/projects/1/issues", {});
  });

  it("passes AbortSignal to read requests", async () => {
    const controller = new AbortController();
    getMock.mockResolvedValue({ data: dummyProject });

    await getProjectApi(1, { signal: controller.signal });

    expect(getMock).toHaveBeenCalledWith("/projects/1", { signal: controller.signal });
  });

  it("creates a project issue", async () => {
    const payload = { title: "New Issue", description: "Desc" };
    const dummyIssue = { issueId: 2, title: "New Issue" };
    postMock.mockResolvedValue({ data: dummyIssue });

    await expect(createProjectIssueApi(1, payload as any)).resolves.toEqual(dummyIssue);
    expect(postMock).toHaveBeenCalledWith("/projects/1/issues", payload);
  });

  it("propagates API errors", async () => {
    const error = new Error("Network Error");
    getMock.mockRejectedValue(error);

    await expect(listProjectsApi()).rejects.toThrow(error);
  });
});
