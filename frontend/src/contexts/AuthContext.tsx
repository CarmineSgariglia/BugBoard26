import React, { useState, useEffect, useCallback } from "react";
import { meApi, type AuthUser } from "../services/api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const data = await meApi();
            setUser(data);
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    return (
        <AuthContext.Provider value={{ user, refreshUser, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
