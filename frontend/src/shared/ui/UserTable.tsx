import { resolveMediaUrl } from "../api/core/media";
import type { AuthUser } from "../api/types/auth";
import { Tag } from "./Tag";
import { GlassCard } from "./GlassCard";
import { StatusBadge } from "./StatusBadge";
import { ScrollableCell } from "./ScrollableCell";
import type { ReactNode } from "react";

export interface UserTableProps {
    users: AuthUser[];
    isLoading?: boolean;
    error?: string;
    showStatus?: boolean;
    showRole?: boolean;
    renderActions?: (user: AuthUser) => ReactNode;
}

export function UserTable({
    users,
    isLoading = false,
    error = "",
    showStatus = true,
    showRole = true,
    renderActions,
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

    const showActions = !!renderActions;

    let profileCol = "col-span-4";
    let emailCol = "col-span-3";
    let actionsCol = "col-span-1";

    if (!showStatus && !showActions && !showRole) {
        profileCol = "col-span-8";
        emailCol = "col-span-4";
    } else if (!showStatus && !showRole) {
        profileCol = "col-span-5";
        emailCol = "col-span-4";
        actionsCol = "col-span-3";
    } else if (!showStatus) {
        profileCol = "col-span-4";
        emailCol = "col-span-4";
        actionsCol = "col-span-2";
    } else if (!showActions) {
        profileCol = "col-span-5";
        emailCol = "col-span-4";
    }

    return (
        <GlassCard className="w-full overflow-hidden p-0 border-none bg-[#1A1D24] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <div className="grid grid-cols-12 gap-4 px-8 py-5 border-b border-white/5 text-[10px] font-bold text-[#8A8F98] uppercase tracking-widest hidden md:grid">
                <div className={profileCol}>User Profile</div>
                <div className={emailCol}>Email Address</div>
                {showRole && <div className="col-span-2">Role</div>}
                {showStatus && <div className="col-span-2">Status</div>}
                {showActions && <div className={`${actionsCol} text-right`}>Actions</div>}
            </div>

            <div className="flex flex-col">
                {users.length === 0 ? (
                    <div className="p-8 text-center text-sm text-neutral-400">No users found matching your criteria.</div>
                ) : (
                    users.map((user) => {
                        const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
                        const displayName = fullName || user.username || "-";
                        const displayUsername = user.username ? `@${user.username}` : "";

                        return (
                            <div key={user.userId} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-2.5 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors group">
                                <div className={`${profileCol} flex items-center gap-4`}>
                                    <div className="h-10 w-10 shrink-0 rounded-full bg-[#fca5a5] flex flex-col items-center justify-center overflow-hidden border border-white/10">
                                        {user.profileImg ? (
                                            <img src={resolveMediaUrl(user.profileImg)} alt={displayName} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-black/60 font-bold text-sm">
                                                {(user.firstName?.[0] || user.username[0]).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <ScrollableCell className="min-w-0 flex-1">
                                        <p className="whitespace-nowrap text-sm font-bold text-white">{displayName}</p>
                                        {displayUsername && <p className="whitespace-nowrap text-xs text-neutral-500">{displayUsername}</p>}
                                        <p className="whitespace-nowrap text-xs text-neutral-500 md:hidden">{user.email}</p>
                                    </ScrollableCell>
                                </div>

                                <ScrollableCell className={`${emailCol} hidden md:flex`}>
                                    <p className="whitespace-nowrap text-sm text-neutral-400">{user.email}</p>
                                </ScrollableCell>

                                {showRole && (
                                    <div className="col-span-2 hidden md:block">
                                        <Tag text={user.isAdmin ? "Administrator" : "Developer"} />
                                    </div>
                                )}

                                {showStatus && (
                                    <div className="col-span-2">
                                        <StatusBadge
                                            text={user.active ? "Active" : "Inactive"}
                                            color={user.active ? "emerald-400" : "neutral-500"}
                                            glow={user.active}
                                        />
                                    </div>
                                )}

                                {showActions && (
                                    <div className={`${actionsCol} flex items-center justify-end gap-3 transition-opacity`}>
                                        {renderActions(user)}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </GlassCard>
    );
}
