import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { usePaginatedUsers } from "../../../../features/user/hooks/usePaginatedUsers";
import { listUsersApi } from "@features/user/api";

// Mock @features/user/api
vi.mock("@features/user/api", () => ({
  listUsersApi: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
};

describe("usePaginatedUsers", () => {
  beforeEach(() => {
    vi.mocked(listUsersApi).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dummyResponse = {
    count: 2,
    next: null,
    previous: null,
    results: [
      { userId: 1, username: "alice", isAdmin: false, active: true },
      { userId: 2, username: "bob", isAdmin: true, active: false }
    ],
  };

  it("loads initial users to default parameters accurately", async () => {
    vi.mocked(listUsersApi).mockResolvedValue(dummyResponse as any);

    const { result } = renderHook(() => usePaginatedUsers(), { wrapper: createWrapper() });

    // React query triggers async fetch on mount
    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith({ page: 1 });
      expect(result.current.users).toHaveLength(2);
      expect(result.current.totalItems).toBe(2);
    });
  });

  it("debounces search filter and triggers a new query fetch with search params", async () => {
    vi.mocked(listUsersApi).mockResolvedValue(dummyResponse as any);

    const { result } = renderHook(() => usePaginatedUsers(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith({ page: 1 });
    });

    // Change Search
    act(() => {
      result.current.setSearch("bob");
    });

    // Verify it is NOT called instantly due to 300ms debounce
    expect(listUsersApi).not.toHaveBeenCalledWith(expect.objectContaining({ search: "bob" }));

    // Wait 400ms for debounce
    await new Promise((resolve) => setTimeout(resolve, 400));

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(expect.objectContaining({ search: "bob", page: 1 }));
    });
  });

  it("updates query parameters accurately on filters change", async () => {
    vi.mocked(listUsersApi).mockResolvedValue(dummyResponse as any);

    const { result } = renderHook(() => usePaginatedUsers(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith({ page: 1 });
    });

    // Set Role to Admin
    act(() => {
      result.current.setRoleFilter("Admin");
    });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(expect.objectContaining({ role: "Admin", page: 1 }));
    });

    // Set Status to Inactive
    act(() => {
      result.current.setStatusFilter("Inactive");
    });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(expect.objectContaining({ role: "Admin", status: "Inactive", page: 1 }));
    });
  });

  it("excludes specific user IDs if passed in options list streams", async () => {
    vi.mocked(listUsersApi).mockResolvedValue(dummyResponse as any);

    renderHook(() => usePaginatedUsers({ excludeUserIds: [2] }), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith({ page: 1, excludeUserIds: "2" });
    });
  });
});
