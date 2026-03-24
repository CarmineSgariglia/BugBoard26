import { useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { meApi } from "@features/auth/api";
import type { AuthUser } from "@shared/api/types/auth";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user = null, isLoading, refetch } = useQuery<AuthUser | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await meApi();
      } catch {
        return null;
      }
    },
    staleTime: 0,
  });

  const refreshUser = useCallback(async () => {
    const result = await refetch();
    return result.data ?? null;
  }, [refetch]);

  return <AuthContext.Provider value={{ user, refreshUser, isLoading }}>{children}</AuthContext.Provider>;
}
