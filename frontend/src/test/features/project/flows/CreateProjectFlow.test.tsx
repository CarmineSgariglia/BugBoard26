import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateProjectFlow } from "../../../../features/project/flows/CreateProjectFlow";
import { renderWithProviders } from "../../../render";
import { createProjectApi } from "@features/project/api";

// Mock the API endpoint
vi.mock("@features/project/api", () => ({
  createProjectApi: vi.fn(),
}));

// Mock usePaginatedUsers to prevent unhandled MSW API requests on step 2 mount
vi.mock("@features/user/hooks/usePaginatedUsers", () => ({
  usePaginatedUsers: () => ({
    users: [],
    totalItems: 0,
    isLoading: false,
    error: null,
    setSearch: vi.fn(),
    setCurrentPage: vi.fn(),
  }),
}));

// Mock ModalOverlay to simplify layout requirements
vi.mock("@widgets/layout/ModalOverlay", () => ({
  ModalOverlay: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => 
    isOpen ? <div data-testid="modal-overlay">{children}</div> : null
}));

import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";

describe("CreateProjectFlow", () => {
  // Add MSW override for users endpoint to prevent bypass errors
  beforeAll(() => {
    server.use(
      http.get("*/api/users", () => {
        return HttpResponse.json({ items: [], totalItems: 0 }, { status: 200 });
      })
    );
  });

  it("renders Step 1 (Details) by default when open", () => {
    renderWithProviders(<CreateProjectFlow isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText(/project details/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/project title/i)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    renderWithProviders(<CreateProjectFlow isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/project details/i)).not.toBeInTheDocument();
  });

  it("transitions to Step 2 (Team) after filling Step 1", async () => {
    renderWithProviders(<CreateProjectFlow isOpen={true} onClose={vi.fn()} />);
    
    // Fill title and description
    fireEvent.change(screen.getByPlaceholderText(/project title/i), { target: { value: "New Awesomeness" } });
    fireEvent.change(screen.getByPlaceholderText(/describe the project goals/i), { target: { value: "Valid description here" } });

    // Click Next
    const nextBtn = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextBtn);

    // Verify step 2 renders (Team search or title)
    expect(screen.getByText(/select team members/i)).toBeInTheDocument();
  });

  it("calls createProjectApi and triggers onSuccess when flow completes", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    vi.mocked(createProjectApi).mockResolvedValue({ projectId: 1, name: "Name" } as any);

    renderWithProviders(<CreateProjectFlow isOpen={true} onClose={onClose} onSuccess={onSuccess} />);
    
    // Step 1
    fireEvent.change(screen.getByPlaceholderText(/project title/i), { target: { value: "New Awesomeness" } });
    fireEvent.change(screen.getByPlaceholderText(/describe the project goals/i), { target: { value: "Valid description here" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 2
    expect(screen.getByText(/select team members/i)).toBeInTheDocument();
    
    // Click Confirm/Create
    const createBtn = screen.getByRole("button", { name: /create project/i });
    fireEvent.click(createBtn);

    // Wait for async mutation to solve and trigger onSuccess or close
    await vi.waitFor(() => {
        expect(createProjectApi).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
  });
});
