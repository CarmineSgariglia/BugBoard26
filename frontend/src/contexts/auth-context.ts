import { createContext } from "react";
import type { AuthUser } from "../services/api";

export interface AuthContextType {
    user: AuthUser | null;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
