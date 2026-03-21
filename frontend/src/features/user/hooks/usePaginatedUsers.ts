import { useState, useEffect, useMemo, useCallback } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { listUsersApi } from "@features/user/api";
import type { AuthUser } from "@shared/api/types/auth";
import type { PaginatedResponse } from "@shared/api/types/common";
import type { ListUsersParams } from "@shared/api/types/users";
import { getErrorMessage } from "@shared/lib/error";

interface UsePaginatedUsersOptions {
  initialRole?: "All" | "Admin" | "User";
  initialStatus?: "All" | "Active" | "Inactive";
  userIds?: number[];
  excludeUserIds?: number[];
}

const usersPageSize = 10;

function patchUserInPage(
  page: PaginatedResponse<AuthUser> | undefined,
  updatedUser: AuthUser,
  matchesFilters: boolean,
  params?: ListUsersParams
): PaginatedResponse<AuthUser> | undefined {
  if (!page) return page;

  const existingIndex = page.results.findIndex((user) => user.userId === updatedUser.userId);

  if (!matchesFilters) {
    if (existingIndex === -1) {
      return page;
    }

    return {
      ...page,
      count: Math.max(0, page.count - 1),
      results: page.results.filter((user) => user.userId !== updatedUser.userId),
    };
  }

  if (existingIndex === -1) {
    const pageNumber = params?.page ?? 1;
    if (pageNumber !== 1) {
      return page;
    }

    return {
      ...page,
      count: page.count + 1,
      results: [updatedUser, ...page.results].slice(0, usersPageSize),
    };
  }

  return {
    ...page,
    results: page.results.map((user) =>
      user.userId === updatedUser.userId ? updatedUser : user
    ),
  };
}

function parseCsvIds(value?: string): number[] | null {
  if (!value) return null;

  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));

  return parsed.length ? parsed : null;
}

function matchesSearch(user: AuthUser, search?: string): boolean {
  const trimmedSearch = search?.trim().toLowerCase();
  if (!trimmedSearch) return true;

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim().toLowerCase();
  const haystacks = [
    user.username,
    user.email,
    user.firstName,
    user.lastName,
    fullName,
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  return haystacks.some((value) => value.includes(trimmedSearch));
}

function userMatchesParams(user: AuthUser, params?: ListUsersParams): boolean {
  if (!params) return true;

  if (!matchesSearch(user, params.search)) {
    return false;
  }

  if (params.role === "Admin" && !user.isAdmin) {
    return false;
  }

  if (params.role === "User" && user.isAdmin) {
    return false;
  }

  if (params.status === "Active" && !user.active) {
    return false;
  }

  if (params.status === "Inactive" && user.active) {
    return false;
  }

  const includedUserIds = parseCsvIds(params.userIds);
  if (includedUserIds && !includedUserIds.includes(user.userId)) {
    return false;
  }

  const excludedUserIds = parseCsvIds(params.excludeUserIds);
  if (excludedUserIds?.includes(user.userId)) {
    return false;
  }

  return true;
}

export function usePaginatedUsers(options: UsePaginatedUsersOptions = {}) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">(
    options.initialStatus || "All"
  );
  const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "User">(
    options.initialRole || "All"
  );
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const queryParams = useMemo<ListUsersParams>(() => {
    const params: ListUsersParams = { page: currentPage };

    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) params.search = trimmedSearch;
    if (roleFilter !== "All") params.role = roleFilter;
    if (statusFilter !== "All") params.status = statusFilter;
    if (options.userIds?.length) params.userIds = options.userIds.join(",");
    if (options.excludeUserIds?.length) params.excludeUserIds = options.excludeUserIds.join(",");

    return params;
  }, [currentPage, debouncedSearch, roleFilter, statusFilter, options.userIds, options.excludeUserIds]);

  const query = useQuery({
    queryKey: ["users", queryParams],
    queryFn: ({ signal }) => listUsersApi(queryParams, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const updateLocalUser = useCallback(
    (updatedUser: AuthUser) => {
      const cachedQueries = queryClient.getQueriesData<PaginatedResponse<AuthUser>>({
        queryKey: ["users"],
      });

      cachedQueries.forEach(([queryKey, oldData]) => {
        const [, params] = queryKey as [string, ListUsersParams | undefined];
        const matchesFilters = userMatchesParams(updatedUser, params);

        queryClient.setQueryData<PaginatedResponse<AuthUser>>(queryKey, (currentData) =>
          patchUserInPage(currentData ?? oldData, updatedUser, matchesFilters, params)
        );
      });
    },
    [queryClient]
  );

  const fetchUsers = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const users = query.data?.results ?? [];
  const totalItems = query.data?.count ?? 0;
  const isLoading = query.isLoading;
  const isRefreshing = query.isFetching && !query.isLoading;
  const error = query.error ? getErrorMessage(query.error, "Unable to load users") : "";

  return {
    users,
    totalItems,
    isLoading,
    isRefreshing,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    currentPage,
    setCurrentPage,
    updateLocalUser,
    fetchUsers,
  };
}
