import { useState, useEffect, useCallback } from "react";
import { listUsersApi } from "../api/modules/users";
import type { AuthUser } from "../api/types/auth";
import { getErrorMessage } from "../lib/error";

interface UsePaginatedUsersOptions {
    initialRole?: "All" | "Admin" | "User";
    initialStatus?: "All" | "Active" | "Inactive";
}

export function usePaginatedUsers(options: UsePaginatedUsersOptions = {}) {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [totalItems, setTotalItems] = useState(0);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">(options.initialStatus || "All");
    const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "User">(options.initialRole || "All");
    const [currentPage, setCurrentPage] = useState(1);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const params: any = { page: currentPage };

            if (search.trim()) params.search = search.trim();
            if (roleFilter !== "All") params.role = roleFilter;
            if (statusFilter !== "All") params.status = statusFilter;

            const response = await listUsersApi(params);
            setUsers(response.results);
            setTotalItems(response.count);
        } catch (err) {
            setError(getErrorMessage(err, "Unable to load users"));
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, search, roleFilter, statusFilter]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUsers();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [fetchUsers]);

    // Quando i filtri cambiano, torniamo alla pagina 1
    useEffect(() => {
        setCurrentPage(1);
    }, [search, roleFilter, statusFilter]);

    // Funzione utile per aggiornare un singolo utente (es. dopo averne invertito lo stato o modificato i dati)
    const updateLocalUser = useCallback((updatedUser: AuthUser) => {
        setUsers(prev => prev.map(u => u.userId === updatedUser.userId ? updatedUser : u));
    }, []);

    return {
        users,
        totalItems,
        isLoading,
        error,
        search, setSearch,
        statusFilter, setStatusFilter,
        roleFilter, setRoleFilter,
        currentPage, setCurrentPage,
        updateLocalUser,
        fetchUsers
    };
}

