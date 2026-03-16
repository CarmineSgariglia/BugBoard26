import { useState, useMemo } from "react";
import { SearchBar } from "./SearchBar";
import { UserTable } from "./UserTable";
import { Pagination } from "./Pagination";
import { Select } from "./Select";
import { FiPlus, FiX } from "react-icons/fi";
import { ScrollComponent } from "./ScrollComponent";
import type { AuthUser } from "../api/types/auth";
import { isAdminLike } from "../lib";
import { Tag } from "./Tag";

type SuggestedMeta = {
    openAssignments: number;
    suggestionScore?: number;
    rank: number;
};

interface UserSelectorTableProps {
    users: AuthUser[];
    selectedUserIds: number[];
    onToggleUser?: (userId: number) => void;
    isLoading?: boolean;
    error?: string;
    isViewMode?: boolean;
    currentPage?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    search?: string;
    onSearchChange?: (val: string) => void;
    onMembershipFilterChange?: (filter: string) => void;
    suggestedMetaByUserId?: Record<number, SuggestedMeta>;
    enableSuggestedFilter?: boolean;
}

export function UserSelectorTable({
    users,
    selectedUserIds,
    onToggleUser,
    isLoading = false,
    error = "",
    isViewMode = false,
    currentPage = 1,
    totalItems = 0,
    onPageChange,
    search = "",
    onSearchChange,
    onMembershipFilterChange,
    suggestedMetaByUserId = {},
    enableSuggestedFilter = false,
}: UserSelectorTableProps) {
    const [membershipFilter, setMembershipFilter] = useState<string>(isViewMode ? "Added" : "All");

    const handleMembershipFilterChange = (value: string) => {
        setMembershipFilter(value);
        onMembershipFilterChange?.(value);
    };

    const filteredUsers = useMemo(() => {
        const baseUsers = users.filter(user => {
            if (isAdminLike(user)) return false;

            const searchLower = search.trim().toLowerCase();
            const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim().toLowerCase();
            const matchesSearch = !searchLower ||
                user.username.toLowerCase().includes(searchLower) ||
                fullName.includes(searchLower) ||
                (user.email && user.email.toLowerCase().includes(searchLower));

            if (!matchesSearch) return false;

            if (membershipFilter === "Added") return selectedUserIds.includes(user.userId);
            if (membershipFilter === "NotAdded") return !selectedUserIds.includes(user.userId);

            return true;
        });

        if (membershipFilter !== "Suggested") return baseUsers;

        return [...baseUsers].sort((a, b) => {
            const aMeta = suggestedMetaByUserId[a.userId];
            const bMeta = suggestedMetaByUserId[b.userId];
            const aHasScore = typeof aMeta?.suggestionScore === "number";
            const bHasScore = typeof bMeta?.suggestionScore === "number";
            if (aHasScore && bHasScore) {
                const scoreDiff = (bMeta!.suggestionScore as number) - (aMeta!.suggestionScore as number);
                if (scoreDiff !== 0) return scoreDiff;
            } else if (aHasScore !== bHasScore) {
                return aHasScore ? -1 : 1;
            }

            const openDiff = (aMeta?.openAssignments ?? Number.MAX_SAFE_INTEGER) - (bMeta?.openAssignments ?? Number.MAX_SAFE_INTEGER);
            if (openDiff !== 0) return openDiff;

            const rankDiff = (aMeta?.rank ?? Number.MAX_SAFE_INTEGER) - (bMeta?.rank ?? Number.MAX_SAFE_INTEGER);
            if (rankDiff !== 0) return rankDiff;

            return a.username.localeCompare(b.username);
        });
    }, [users, membershipFilter, selectedUserIds, search, suggestedMetaByUserId]);

    const membershipOptions = useMemo(() => {
        const options = [{ label: "All Members", value: "All" }];
        if (enableSuggestedFilter) {
            options.push({ label: "Suggested", value: "Suggested" });
        }
        options.push({ label: "Already Added", value: "Added" });
        options.push({ label: "Not Added", value: "NotAdded" });
        return options;
    }, [enableSuggestedFilter]);

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <SearchBar
                        value={search}
                        onChange={onSearchChange || (() => { })}
                        placeholder="Search developers..."
                        bgColor="bg-[#0D0D12]/50"
                        textColor="text-white"
                        iconColor="text-neutral-500"
                        className="border border-white/10"
                    />
                </div>

                {!isViewMode && (
                    <Select
                        value={membershipFilter}
                        onChange={(val) => handleMembershipFilterChange(val)}
                        className="w-48"
                        options={membershipOptions}
                    />
                )}

                {!isViewMode && (
                    <span className="bg-[#5671F6]/20 text-[#5671F6] px-3 py-1.5 rounded-full border border-[#5671F6]/30 text-xs font-bold whitespace-nowrap">
                        {selectedUserIds.length} selected
                    </span>
                )}
            </div>

            <div className="flex-1 min-h-0 border border-white/5 bg-[#121620]/30 rounded-xl overflow-hidden flex flex-col">
                <ScrollComponent maxHeight="h-[300px]" hideBorder>
                    <UserTable
                        users={filteredUsers}
                        isLoading={isLoading}
                        error={error}
                        showStatus={false}
                        showRole={false}
                        renderProfileMeta={membershipFilter === "Suggested" ? (user) => {
                            const meta = suggestedMetaByUserId[user.userId];
                            if (!meta) return null;
                            return (
                                <Tag
                                    text={`Issues active: ${meta.openAssignments}`}
                                    className={`!text-[11px] !px-2 !py-0.5 ${meta.openAssignments <= 3 ? "text-emerald-400 border-emerald-400/30" :
                                        meta.openAssignments <= 6 ? "text-amber-300 border-amber-300/30" :
                                            "text-red-400 border-red-400/30"
                                        }`}
                                />
                            );
                        } : undefined}
                        renderActions={isViewMode ? undefined : (user) => {
                            const isSelected = selectedUserIds.includes(user.userId);
                            return (
                                <button
                                    type="button"
                                    onClick={() => onToggleUser?.(user.userId)}
                                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all w-[90px] ${isSelected
                                        ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                        : "bg-[#5671F6]/10 text-[#5671F6] border border-[#5671F6]/20 hover:bg-[#5671F6]/20"
                                        }`}
                                >
                                    {isSelected ? (
                                        <>
                                            <FiX size={14} />
                                            Remove
                                        </>
                                    ) : (
                                        <>
                                            <FiPlus size={14} />
                                            Add
                                        </>
                                    )}
                                </button>
                            );
                        }}
                    />
                </ScrollComponent>

                {totalItems > 0 && !isLoading && !error && onPageChange && (
                    <div className="border-t border-white/5 bg-[#0D0D12]/20">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={10}
                            onPageChange={onPageChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
