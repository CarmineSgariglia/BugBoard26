import { FiEdit2 } from "react-icons/fi";
import { MdGroupOff } from "react-icons/md";
import { resolveMediaUrl, type AuthUser } from "../../services/api";
import { Tag } from "../ui/Tag";
import { GlassCard } from "../ui/GlassCard";
import { StatusBadge } from "../ui/StatusBadge";

export interface UserTableProps {
    users: AuthUser[];
    isLoading?: boolean;
    error?: string;
    showStatus?: boolean;
    showActions?: boolean;
    showOnlyActive?: boolean;
    onEditClick?: (user: AuthUser) => void;
    onDeleteClick?: (user: AuthUser) => void;
}

export function UserTable({
    users,
    isLoading = false,
    error = "",
    showStatus = true,
    showActions = true,
    showOnlyActive = false,
    onEditClick,
    onDeleteClick
}: UserTableProps) {
    if (isLoading) {
        return (
            <GlassCard className="w-full overflow-hidden p-0 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="p-8 text-center text-sm text-neutral-400">Loading users...</div>
            </GlassCard>
        );
    }

    if (error) {
        return (
            <GlassCard className="w-full overflow-hidden p-0 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="p-8 text-center text-sm text-red-400">{error}</div>
            </GlassCard>
        );
    }

    const filteredUsers = showOnlyActive ? users.filter(u => u.active) : users;

    // Hardcode column spans to be compatible with Tailwind's static analysis
    let profileCol = "col-span-4";
    let emailCol = "col-span-3";

    if (!showStatus && !showActions) {
        profileCol = "col-span-6";
        emailCol = "col-span-4";
    } else if (!showStatus) {
        profileCol = "col-span-5";
        emailCol = "col-span-4";
    } else if (!showActions) {
        profileCol = "col-span-5";
        emailCol = "col-span-3";
    }

    return (
        <GlassCard className="w-full overflow-hidden p-0 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            {/* Table Header */}
            <div className={`grid grid-cols-12 gap-4 px-8 py-5 border-b border-white/5 text-[10px] font-bold text-[#8A8F98] uppercase tracking-widest hidden md:grid`}>
                <div className={profileCol}>User Profile</div>
                <div className={emailCol}>Email Address</div>
                <div className="col-span-2">Role</div>
                {showStatus && <div className="col-span-2">Status</div>}
                {showActions && <div className="col-span-1 text-right">Actions</div>}
            </div>

            {/* Table Body */}
            <div className="flex flex-col">
                {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-sm text-neutral-400">No users found matching your criteria.</div>
                ) : (
                    filteredUsers.map((user) => {
                        const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "-";
                        return (
                            <div key={user.userId} className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-2.5 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors group`}>

                                {/* User Profile Cell */}
                                <div className={`${profileCol} flex items-center gap-4`}>
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
                                <div className={`${emailCol} hidden md:block`}>
                                    <p className="truncate text-sm text-neutral-400">{user.email}</p>
                                </div>

                                {/* Role Cell */}
                                <div className="col-span-2 hidden md:block">
                                    <Tag
                                        text={user.isAdmin ? "Administrator" : "Developer"}
                                    />
                                </div>

                                {/* Status Cell */}
                                {showStatus && (
                                    <div className="col-span-2">
                                        <StatusBadge
                                            text={user.active ? "Active" : "Inactive"}
                                            color={user.active ? "emerald-400" : "neutral-500"}
                                            glow={user.active}
                                        />
                                    </div>
                                )}

                                {/* Actions Cell */}
                                {showActions && (
                                    <div className="col-span-1 flex items-center justify-end gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        {onEditClick && (
                                            <button
                                                onClick={() => onEditClick(user)}
                                                className="text-neutral-500 hover:text-white transition-colors"
                                                title="Edit User"
                                            >
                                                <FiEdit2 size={16} />
                                            </button>
                                        )}
                                        {onDeleteClick && (
                                            <button
                                                onClick={() => onDeleteClick(user)}
                                                className="text-neutral-500 hover:text-red-400 transition-colors"
                                                title="Delete User"
                                            >
                                                <MdGroupOff size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}

                            </div>
                        );
                    })
                )}
            </div>
            {/* Note: Pagination is rendered outside, because tables don't usually own pagination logic. The caller will append Pagination below this Table component. */}
        </GlassCard>
    );
}
