import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { GlassCard } from "../ui/GlassCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { disableUserApi, listUsersApi, meApi, type AuthUser } from "../../services/api";

function getErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    return fallback;
}

export function ManageUsersSection() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [busyUserId, setBusyUserId] = useState<number | null>(null);

    const loadUsers = async (q?: string) => {
        const data = await listUsersApi(q);
        setUsers(data);
    };

    useEffect(() => {
        const run = async () => {
            setIsLoading(true);
            setError("");
            try {
                const [me, allUsers] = await Promise.all([meApi(), listUsersApi()]);
                setCurrentUserId(me.userId);
                setUsers(allUsers);
            } catch (err) {
                setError(getErrorMessage(err, "Unable to load users"));
            } finally {
                setIsLoading(false);
            }
        };
        run();
    }, []);

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return users;
        return users.filter((user) => {
            const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim().toLowerCase();
            return (
                user.username.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query) ||
                fullName.includes(query)
            );
        });
    }, [users, search]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setError("");
        try {
            await loadUsers(search.trim() || undefined);
        } catch (err) {
            setError(getErrorMessage(err, "Unable to refresh users"));
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDisable = async (user: AuthUser) => {
        if (!user.active) return;
        if (user.userId === currentUserId) return;
        const confirmation = window.prompt(`Type "${user.username}" to disable this user`);
        if (confirmation !== user.username) return;

        setBusyUserId(user.userId);
        setError("");
        try {
            await disableUserApi(user.userId, user.username);
            setUsers((prev) =>
                prev.map((item) => (item.userId === user.userId ? { ...item, active: false } : item)),
            );
        } catch (err) {
            setError(getErrorMessage(err, "Unable to disable user"));
        } finally {
            setBusyUserId(null);
        }
    };

    return (
        <GlassCard className="w-full p-8">
            <div className="flex items-center gap-3">
                <TextField
                    placeholder="Search users"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="bg-[#1A1D24] border-white/5 h-11"
                />
                <Button
                    type="button"
                    variant="ghost"
                    fullWidth={false}
                    onClick={handleRefresh}
                    isLoading={isRefreshing}
                    disabled={isRefreshing}
                >
                    Refresh
                </Button>
            </div>

            {isLoading ? <p className="mt-6 text-sm text-neutral-400">Loading users...</p> : null}
            {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

            {!isLoading && filteredUsers.length === 0 ? (
                <p className="mt-6 text-sm text-neutral-400">No users found.</p>
            ) : null}

            <div className="mt-6 space-y-3">
                {filteredUsers.map((user) => {
                    const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "-";
                    const isSelf = user.userId === currentUserId;
                    const isDisableBusy = busyUserId === user.userId;
                    return (
                        <div
                            key={user.userId}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{fullName}</p>
                                <p className="truncate text-xs text-neutral-400">{user.email}</p>
                                <p className="truncate text-xs text-neutral-500">
                                    @{user.username} · {user.isAdmin ? "Admin" : "Developer"} · {user.active ? "Active" : "Disabled"}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                fullWidth={false}
                                onClick={() => handleDisable(user)}
                                disabled={!user.active || isSelf || isDisableBusy}
                                isLoading={isDisableBusy}
                            >
                                Disable
                            </Button>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
}
