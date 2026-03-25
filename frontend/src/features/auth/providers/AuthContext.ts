import { createContext } from "react";

import type { AuthUser } from "@shared/api/types/auth";

export interface AuthContextType {
  user: AuthUser | null;
  refreshUser: (options?: { clearOnUnauthorized?: boolean }) => Promise<AuthUser | null>;
  setAuthenticatedUser: (user: AuthUser | null) => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
