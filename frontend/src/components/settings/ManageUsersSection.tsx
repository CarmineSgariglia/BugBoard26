import { useEffect, useMemo, useState, useCallback } from "react";
import { GlassCard } from "../ui/GlassCard";
import { SearchBar } from "../ui/SearchBar";
import { Select } from "../ui/Select";
import { Pagination } from "../ui/Pagination";
import { listUsersApi, disableUserApi, type AuthUser } from "../../services/api";
import { getErrorMessage } from "../../utils/error";
import { UserTable } from "./UserTable";
import { AdminUserEditSection } from "./AdminUserEditSection";
import { ToggleUserStatusModal } from "./ToggleUserStatusModal";

export interface ManageUsersSectionProps {
    onEditingChange?: (isEditing: boolean) => void;
}

export function ManageUsersSection({ onEditingChange }: ManageUsersSectionProps) {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
    const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "User">("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
    const [toggleStatusUser, setToggleStatusUser] = useState<AuthUser | null>(null);
    const [isToggling, setIsToggling] = useState(false);

    useEffect(() => {
        const run = async () => {
            setIsLoading(true);
            setError("");
            try {
                const allUsers = await listUsersApi();
                setUsers(allUsers);
            } catch (err) {
                setError(getErrorMessage(err, "Unable to load users"));
            } finally {
                setIsLoading(false);
            }
        };
        run();
    }, []);

    // 1. Filter
    const filteredUsers = useMemo(() => {
        let result = users;

        // Apply Status Filter
        if (statusFilter === "Active") {
            result = result.filter(u => u.active);
        } else if (statusFilter === "Inactive") {
            result = result.filter(u => !u.active);
        }

        // Apply Role Filter
        if (roleFilter === "Admin") {
            result = result.filter(u => u.isAdmin);
        } else if (roleFilter === "User") {
            result = result.filter(u => !u.isAdmin);
        }

        // Apply Text Search
        const query = search.trim().toLowerCase();
        if (query) {
            result = result.filter((user) => {
                const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim().toLowerCase();
                return (
                    user.username.toLowerCase().includes(query) ||
                    user.email.toLowerCase().includes(query) ||
                    fullName.includes(query)
                );
            });
        }

        return result;
    }, [users, search, statusFilter, roleFilter]);

    // 2. Pagination
    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    // Safety check if page goes out of bounds after filtering
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(1);
    }, [totalPages, currentPage]);

    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredUsers, currentPage]);

    const handleActionClick = (actionName: string, user: AuthUser) => {
        if (actionName === 'Edit') {
            setEditingUser(user);
            onEditingChange?.(true);
        } else if (actionName === 'Delete') {
            setToggleStatusUser(user);
        }
    }

    const handleToggleStatus = useCallback(async () => {
        if (!toggleStatusUser) return;
        setIsToggling(true);
        try {
            await disableUserApi(toggleStatusUser.userId, toggleStatusUser.username);
            // Toggle the active status locally
            setUsers(prev => prev.map(u =>
                u.userId === toggleStatusUser.userId
                    ? { ...u, active: !u.active }
                    : u
            ));
            setToggleStatusUser(null);
        } catch (err) {
            console.error("Failed to toggle user status", err);
        } finally {
            setIsToggling(false);
        }
    }, [toggleStatusUser]);

    if (editingUser) {
        return (
            <div className="w-full">
                <AdminUserEditSection
                    user={editingUser}
                    onClose={() => {
                        setEditingUser(null);
                        onEditingChange?.(false);
                    }}
                    onUserUpdated={(updatedUser) => {
                        setUsers(prev => prev.map(u => u.userId === updatedUser.userId ? updatedUser : u));
                        setEditingUser(null);
                        onEditingChange?.(false);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-6 mb-16">

            {/* Header Text */}
            <div className="text-center mb-2">
                <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Manage Users</h1>
                <p className="text-sm font-medium text-neutral-400">View and manage all registered users in the BugBoard system.</p>
            </div>

            {/* Toolbar (Search & Filter) */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <SearchBar
                        value={search}
                        onChange={setSearch}
                        placeholder="Search by name or email..."
                        bgColor="bg-[#1A1D24]"
                        textColor="text-white"
                        iconColor="text-neutral-400"
                        className="border border-white/5 !py-2.5 !shadow-none"
                    />
                </div>
                <div className="w-full sm:w-48">
                    <Select
                        value={roleFilter}
                        onChange={(value) => setRoleFilter(value as any)}
                        options={[
                            { label: "All Roles", value: "All" },
                            { label: "Administrators", value: "Admin" },
                            { label: "Developers", value: "User" }
                        ]}
                    />
                </div>
                <div className="w-full sm:w-48">
                    <Select
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value as any)}
                        options={[
                            { label: "All Users", value: "All" },
                            { label: "Active Users", value: "Active" },
                            { label: "Inactive Users", value: "Inactive" }
                        ]}
                    />
                </div>
            </div>

            {/* Main Table Card */}
            <GlassCard className="w-full overflow-hidden p-0 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">

                <UserTable
                    users={paginatedUsers}
                    isLoading={isLoading}
                    error={error}
                    showStatus={true}
                    showActions={true}
                    onEditClick={(user) => handleActionClick('Edit', user)}
                    onDeleteClick={(user) => handleActionClick('Delete', user)}
                />

                {/* Pagination Footer */}
                {totalItems > 0 && !isLoading && !error && (
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                )}
            </GlassCard>

            <ToggleUserStatusModal
                isOpen={toggleStatusUser !== null}
                user={toggleStatusUser}
                onClose={() => setToggleStatusUser(null)}
                onConfirm={handleToggleStatus}
                isLoading={isToggling}
            />
        </div>
    );
}
