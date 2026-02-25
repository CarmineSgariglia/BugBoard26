import { useEffect, useMemo, useState } from "react";
import { SettingsCard } from "./SettingsCard";
import { TextField } from "../auth/TextField";
import { disableUserApi, listUsersApi, type AuthUser } from "../../services/api";

export function ManageUsersSection() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyUserId, setBusyUserId] = useState<number | null>(null);

    const loadUsers = async (search?: string) => {
        setIsLoading(true);
        setError("");
        try {
            const data = await listUsersApi(search);
            setUsers(data);
        } catch {
            setError("Unable to load users.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const visibleUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                u.username.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.firstName || "").toLowerCase().includes(q) ||
                (u.lastName || "").toLowerCase().includes(q),
        );
    }, [query, users]);

    const disableUser = async (user: AuthUser) => {
        const confirmation = window.prompt(`Type username "${user.username}" to disable this user`, "");
        if (!confirmation) return;
        setBusyUserId(user.userId);
        try {
            await disableUserApi(user.userId, confirmation);
            await loadUsers(query.trim() || undefined);
        } catch {
            setError("Unable to disable user. Check confirmation or permissions.");
        } finally {
            setBusyUserId(null);
        }
    };

    return (
        <SettingsCard className="w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Manage Users</h2>
            <div className="mb-4">
                <TextField
                    placeholder="Search users by username, email, name"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            {isLoading ? <p className="text-sm text-neutral-400">Loading users...</p> : null}
            {error ? <p className="text-sm text-red-400 mb-2">{error}</p> : null}

            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                {visibleUsers.map((user) => (
                    <div
                        key={user.userId}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-[#13151A] px-3 py-3"
                    >
                        <div>
                            <p className="text-sm font-semibold text-white">{user.username}</p>
                            <p className="text-xs text-neutral-400">{user.email}</p>
                            <p className="text-xs text-neutral-500">
                                {user.firstName || "-"} {user.lastName || "-"} · {user.active === false ? "disabled" : "active"}
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={user.active === false || busyUserId === user.userId}
                            onClick={() => disableUser(user)}
                            className="rounded-md border border-red-500/50 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                            {busyUserId === user.userId ? "Disabling..." : "Disable"}
                        </button>
                    </div>
                ))}
                {!isLoading && visibleUsers.length === 0 ? (
                    <p className="text-sm text-neutral-400">No users found.</p>
                ) : null}
            </div>
        </SettingsCard>
    );
}
