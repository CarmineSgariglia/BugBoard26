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

function patchUserInPage(
  page: PaginatedResponse<AuthUser> | undefined,
  updatedUser: AuthUser
): PaginatedResponse<AuthUser> | undefined {
  if (!page) return page;
  return {
    ...page,
    results: page.results.map((user) =>
      user.userId === updatedUser.userId ? updatedUser : user
    ),
  };
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
    queryFn: () => listUsersApi(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const updateLocalUser = useCallback(
    (updatedUser: AuthUser) => {
      queryClient.setQueriesData<PaginatedResponse<AuthUser>>(
        { queryKey: ["users"] },
        (oldData) => patchUserInPage(oldData, updatedUser)
      );
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
