import { useState } from "react";
import { SearchBar } from "./SearchBar";
import { UserTable } from "./UserTable";
import { Pagination } from "./Pagination";
import { Select } from "./Select";
import { FiPlus, FiX } from "react-icons/fi";
import type { AuthUser } from "../../services/api";

interface UserSelectorTableProps {
    users: AuthUser[];
    selectedUserIds: number[];
    onToggleUser?: (userId: number) => void;
    isLoading?: boolean;
    error?: string;
    isViewMode?: boolean;
    // Props per la paginazione interna (se vuoi rimetterla qui) o dall'esterno
    currentPage?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    // Props per la ricerca
    search?: string;
    onSearchChange?: (val: string) => void;
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
    onSearchChange
}: UserSelectorTableProps) {
    const [membershipFilter, setMembershipFilter] = useState<string>(isViewMode ? "Added" : "All");

    // Filtriamo localmente solo per Added/Not Added
    const filteredUsers = users.filter(user => {
        if (membershipFilter === "Added") return selectedUserIds.includes(user.userId);
        if (membershipFilter === "NotAdded") return !selectedUserIds.includes(user.userId);
        return true;
    });

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Search Bar + Select + Selected Count */}
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <SearchBar
                        value={search}
                        onChange={onSearchChange || (() => { })}
                        placeholder="Search developers by name or email..."
                        bgColor="bg-[#0D0D12]/50"
                        textColor="text-white"
                        iconColor="text-neutral-500"
                        className="border border-white/10"
                    />
                </div>

                {!isViewMode && (
                    <Select
                        value={membershipFilter}
                        onChange={(val) => setMembershipFilter(val)}
                        className="w-48"
                        options={[
                            { label: "All Members", value: "All" },
                            { label: "Already Added", value: "Added" },
                            { label: "Not Added", value: "NotAdded" }
                        ]}
                    />
                )}

                {!isViewMode && (
                    <span className="bg-[#5671F6]/20 text-[#5671F6] px-3 py-1.5 rounded-full border border-[#5671F6]/30 text-xs font-bold whitespace-nowrap">
                        {selectedUserIds.length} selected
                    </span>
                )}
            </div>

            <div className="flex-1 min-h-0 border border-white/5 bg-[#121620]/30 rounded-xl overflow-hidden flex flex-col">
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    <UserTable
                        users={filteredUsers}
                        isLoading={isLoading}
                        error={error}
                        showStatus={false}
                        showRole={false}
                        renderActions={isViewMode ? undefined : (user) => {
                            const isSelected = selectedUserIds.includes(user.userId);
                            return (
                                <button
                                    type="button" // Previene il submit del form
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
                </div>

                {/* Pagination */}
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
