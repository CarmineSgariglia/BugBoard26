import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { GlassCard } from "../ui/GlassCard";
import { SearchBar } from "../ui/SearchBar";
import { listUsersApi, meApi, resolveMediaUrl, type AuthUser } from "../../services/api";
import { FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight } from "react-icons/fi";

function getErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    return fallback;
}

export function ManageUsersSection() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const run = async () => {
            setIsLoading(true);
            setError("");
            try {
                const [, allUsers] = await Promise.all([meApi(), listUsersApi()]);
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
    }, [users, search, statusFilter]);

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
        console.log(`${actionName} clicked for user:`, user.email);
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
                        placeholder="Search by name, email or department..."
                        bgColor="bg-[#1A1D24]"
                        textColor="text-white"
                        iconColor="text-neutral-400"
                        className="border border-white/5 !py-2.5 !shadow-none"
                    />
                </div>
                <div className="w-full sm:w-64">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full h-[46px] rounded-full bg-[#1A1D24] border border-white/5 px-5 text-sm text-white focus:border-white/20 focus:outline-none appearance-none cursor-pointer"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg stroke='rgba(255,255,255,0.4)' fill='none' stroke-width='2' viewBox='0 0 24 24' stroke-linecap='round' stroke-linejoin='round' height='1em' width='1em' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 1rem center",
                            backgroundSize: "1em"
                        }}
                    >
                        <option value="All">All Users</option>
                        <option value="Active">Active Users</option>
                        <option value="Inactive">Inactive Users</option>
                    </select>
                </div>
            </div>

            {/* Main Table Card */}
            <GlassCard className="w-full overflow-hidden p-0 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">

                {isLoading ? (
                    <div className="p-8 text-center text-sm text-neutral-400">Loading users...</div>
                ) : error ? (
                    <div className="p-8 text-center text-sm text-red-400">{error}</div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-8 py-5 border-b border-white/5 text-[10px] font-bold text-[#8A8F98] uppercase tracking-widest hidden md:grid">
                            <div className="col-span-4">User Profile</div>
                            <div className="col-span-3">Email Address</div>
                            <div className="col-span-2">Role</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex flex-col">
                            {paginatedUsers.length === 0 ? (
                                <div className="p-8 text-center text-sm text-neutral-400">No users found matching your criteria.</div>
                            ) : (
                                paginatedUsers.map((user) => {
                                    const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "-";
                                    return (
                                        <div key={user.userId} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-4 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors group">

                                            {/* User Profile Cell */}
                                            <div className="col-span-4 flex items-center gap-4">
                                                <div className="h-10 w-10 shrink-0 rounded-full bg-[#fca5a5] flex flex-col items-center justify-center overflow-hidden border border-white/10">
                                                    {user.profileImg ? (
                                                        <img src={resolveMediaUrl(user.profileImg)} alt={fullName} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-black/60 font-bold text-sm">
                                                            {(user.firstName?.[0] || user.username[0]).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-white">{fullName}</p>
                                                    <p className="truncate text-xs text-neutral-500 md:hidden">{user.email}</p>
                                                </div>
                                            </div>

                                            {/* Email Cell */}
                                            <div className="col-span-3 hidden md:block">
                                                <p className="truncate text-sm text-neutral-400">{user.email}</p>
                                            </div>

                                            {/* Role Cell */}
                                            <div className="col-span-2 hidden md:block">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-[#4A72FF] border border-[#4A72FF]/20">
                                                    {user.isAdmin ? "Administrator" : "Standard User"}
                                                </span>
                                            </div>

                                            {/* Status Cell */}
                                            <div className="col-span-2 flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${user.active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-neutral-500'}`}></div>
                                                <span className={`text-sm ${user.active ? 'text-emerald-400' : 'text-neutral-500'}`}>
                                                    {user.active ? "Active" : "Inactive"}
                                                </span>
                                            </div>

                                            {/* Actions Cell */}
                                            <div className="col-span-1 flex items-center justify-end gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleActionClick('Edit', user)}
                                                    className="text-neutral-500 hover:text-white transition-colors"
                                                    title="Edit User"
                                                >
                                                    <FiEdit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleActionClick('Delete', user)}
                                                    className="text-neutral-500 hover:text-red-400 transition-colors"
                                                    title="Delete User"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </div>

                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {totalItems > 0 && (
                            <div className="px-8 py-5 bg-[#14161B] flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
                                <span className="text-xs text-neutral-500 font-medium tracking-wide">
                                    Showing <span className="text-white font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-white font-bold">{totalItems}</span> users
                                </span>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-neutral-400 transition-all font-bold text-sm"
                                    >
                                        <FiChevronLeft size={16} />
                                    </button>

                                    {/* Page Numbers */}
                                    {Array.from({ length: totalPages }).map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-md transition-all font-bold text-sm ${currentPage === i + 1 ? 'bg-[#4A72FF] text-white shadow-lg shadow-[#4A72FF]/20' : 'bg-transparent text-neutral-400 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-neutral-400 transition-all font-bold text-sm"
                                    >
                                        <FiChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </GlassCard>
        </div>
    );
}
