import axios from "axios";
import { useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { meApi } from "@features/auth/api";
import type { AuthUser } from "@shared/api/types/auth";
import { AuthContext } from "./AuthContext";

const authMeQueryKey = ["auth", "me"] as const;

function isUnauthorizedAuthError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const statusCode = error.response?.status;
  return statusCode === 401 || statusCode === 403;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user = null, isLoading } = useQuery<AuthUser | null>({
    queryKey: authMeQueryKey,
    queryFn: async () => {
      try {
        return await meApi();
      } catch {
        return null;
      }
    },
    staleTime: 0,
  });

  const refreshUser = useCallback(async (options?: { clearOnUnauthorized?: boolean }) => {
    const clearOnUnauthorized = options?.clearOnUnauthorized ?? true;
    try {
      const nextUser = await meApi();
      queryClient.setQueryData(authMeQueryKey, nextUser);
      return nextUser;
    } catch (error) {
      if (!isUnauthorizedAuthError(error)) {
        throw error;
      }
      if (clearOnUnauthorized) {
        queryClient.setQueryData(authMeQueryKey, null);
      }
      return null;
    }
  }, [queryClient]);

  const setAuthenticatedUser = useCallback(
    (nextUser: AuthUser | null) => {
      queryClient.setQueryData(authMeQueryKey, nextUser);
    },
    [queryClient],
  );

  return (
    <AuthContext.Provider value={{ user, refreshUser, setAuthenticatedUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
