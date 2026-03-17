import { useCallback, createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { meApi } from "@features/auth/api";
import type { AuthUser } from "@shared/api/types/auth";

interface AuthContextType {
  user: AuthUser | null;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    await refetch();
  }, [refetch]);

  return <AuthContext.Provider value={{ user, refreshUser, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
