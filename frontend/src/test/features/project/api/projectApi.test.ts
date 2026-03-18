import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listProjectsApi,
  getProjectApi,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
} from "@features/project/api/projectApi";

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@shared/api/core/client", () => ({
  __esModule: true,
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

describe("feature project api module", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
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

  it("fetches a single project by id", async () => {
    getMock.mockResolvedValue({ data: dummyProject });

    await expect(getProjectApi(1)).resolves.toEqual(dummyProject);
    expect(getMock).toHaveBeenCalledWith("/projects/1");
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
});
