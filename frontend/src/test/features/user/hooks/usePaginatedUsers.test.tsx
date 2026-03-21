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

const createWrapper = (queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})) => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

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
      expect(listUsersApi).toHaveBeenCalledWith(
        { page: 1 },
        { signal: expect.any(AbortSignal) }
      );
      expect(result.current.users).toHaveLength(2);
      expect(result.current.totalItems).toBe(2);
    });
  });

  it("debounces search filter and triggers a new query fetch with search params", async () => {
    vi.mocked(listUsersApi).mockResolvedValue(dummyResponse as any);

    const { result } = renderHook(() => usePaginatedUsers(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(
        { page: 1 },
        { signal: expect.any(AbortSignal) }
      );
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
      expect(listUsersApi).toHaveBeenCalledWith(
        expect.objectContaining({ search: "bob", page: 1 }),
        { signal: expect.any(AbortSignal) }
      );
    });
  });

  it("updates query parameters accurately on filters change", async () => {
    vi.mocked(listUsersApi).mockResolvedValue(dummyResponse as any);

    const { result } = renderHook(() => usePaginatedUsers(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(
        { page: 1 },
        { signal: expect.any(AbortSignal) }
      );
    });

    // Set Role to Admin
    act(() => {
      result.current.setRoleFilter("Admin");
    });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(
        expect.objectContaining({ role: "Admin", page: 1 }),
        { signal: expect.any(AbortSignal) }
      );
    });

    // Set Status to Inactive
    act(() => {
      result.current.setStatusFilter("Inactive");
    });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(
        expect.objectContaining({ role: "Admin", status: "Inactive", page: 1 }),
        { signal: expect.any(AbortSignal) }
      );
    });
  });

  it("excludes specific user IDs if passed in options list streams", async () => {
    vi.mocked(listUsersApi).mockResolvedValue(dummyResponse as any);

    renderHook(() => usePaginatedUsers({ excludeUserIds: [2] }), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listUsersApi).toHaveBeenCalledWith(
        { page: 1, excludeUserIds: "2" },
        { signal: expect.any(AbortSignal) }
      );
    });
  });

  it("removes a user immediately from the current filtered view when the updated status no longer matches", async () => {
    const queryClient = createQueryClient();
    const activeUsersResponse = {
      count: 1,
      next: null,
      previous: null,
      results: [{ userId: 1, username: "alice", email: "alice@example.com", isAdmin: false, active: true }],
    };

    queryClient.setQueryData(["users", { page: 1, status: "Active" }], activeUsersResponse);
    vi.mocked(listUsersApi).mockResolvedValue(activeUsersResponse as any);

    const { result } = renderHook(() => usePaginatedUsers({ initialStatus: "Active" }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
      expect(result.current.statusFilter).toBe("Active");
    });

    act(() => {
      result.current.updateLocalUser({
        userId: 1,
        username: "alice",
        email: "alice@example.com",
        isAdmin: false,
        active: false,
      });
    });

    await waitFor(() => {
      expect(result.current.users).toEqual([]);
      expect(result.current.totalItems).toBe(0);
    });
  });

  it("adds a user immediately to a cached filtered view when the updated status starts matching", async () => {
    const queryClient = createQueryClient();
    const inactiveUsersResponse = {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };

    queryClient.setQueryData(["users", { page: 1, status: "Inactive" }], inactiveUsersResponse);
    vi.mocked(listUsersApi).mockResolvedValue(inactiveUsersResponse as any);

    const { result } = renderHook(() => usePaginatedUsers({ initialStatus: "Inactive" }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.users).toEqual([]);
      expect(result.current.statusFilter).toBe("Inactive");
    });

    act(() => {
      result.current.updateLocalUser({
        userId: 1,
        username: "alice",
        email: "alice@example.com",
        isAdmin: false,
        active: false,
      });
    });

    await waitFor(() => {
      expect(result.current.users).toEqual([
        expect.objectContaining({ userId: 1, active: false }),
      ]);
      expect(result.current.totalItems).toBe(1);
    });
  });
});
