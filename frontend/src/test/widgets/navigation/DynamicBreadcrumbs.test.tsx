import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { renderWithProviders } from "../../render";
import { BreadcrumbProvider } from "@shared/providers/BreadcrumbContext";
import { DynamicBreadcrumbs } from "../../../widgets/navigation/DynamicBreadcrumbs";

const { getProjectApiMock, getIssueApiMock } = vi.hoisted(() => ({
  getProjectApiMock: vi.fn(),
  getIssueApiMock: vi.fn(),
}));

vi.mock("@features/project/api", () => ({
  getProjectApi: getProjectApiMock,
}));

vi.mock("@features/issue/api", () => ({
  getIssueApi: getIssueApiMock,
}));

function renderBreadcrumbs(route: string) {
  return renderWithProviders(
    <BreadcrumbProvider>
      <Routes>
        <Route path="/projects/:projectId/issues" element={<DynamicBreadcrumbs />} />
        <Route path="/projects/:projectId/issues/:issueId" element={<DynamicBreadcrumbs />} />
      </Routes>
    </BreadcrumbProvider>,
    { route },
  );
}

describe("DynamicBreadcrumbs", () => {
  beforeEach(() => {
    getProjectApiMock.mockReset();
    getIssueApiMock.mockReset();
  });

  it("loads the current project through the single-project query", async () => {
    getProjectApiMock.mockResolvedValue({
      projectId: 7,
      name: "Apollo",
      createdAt: "2026-03-17T10:00:00Z",
      description: "Project description",
      color: "#123456",
      icon: "folder",
      createdBy: 1,
    });

    renderBreadcrumbs("/projects/7/issues");

    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    expect(getProjectApiMock).toHaveBeenCalledWith("7", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(getIssueApiMock).not.toHaveBeenCalled();
  });

  it("loads both project and issue labels on the issue detail route", async () => {
    getProjectApiMock.mockResolvedValue({
      projectId: 7,
      name: "Apollo",
      createdAt: "2026-03-17T10:00:00Z",
      description: "Project description",
      color: "#123456",
      icon: "folder",
      createdBy: 1,
    });
    getIssueApiMock.mockResolvedValue({
      issueId: 42,
      projectId: 7,
      reporter: { userId: 1, username: "alice", email: "alice@example.com", isAdmin: false },
      title: "Cannot save issue",
      description: "Issue description",
      type: "BUG",
      status: "OPEN",
      priority: "HIGH",
      createdAt: "2026-03-17T10:00:00Z",
      updatedAt: "2026-03-17T10:00:00Z",
      closedAt: null,
      tags: [],
      assignees: [],
    });

    renderBreadcrumbs("/projects/7/issues/42");

    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    expect(await screen.findByText("Cannot save issue")).toBeInTheDocument();
    expect(getProjectApiMock).toHaveBeenCalledWith("7", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(getIssueApiMock).toHaveBeenCalledWith("42", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });
});
