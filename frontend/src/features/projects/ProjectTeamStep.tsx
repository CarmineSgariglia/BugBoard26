import { useState } from "react";
import { ProjectFormLayout } from "../../components/layout/ProjectFormLayout";
import { FooterActions } from "../../components/ui/FooterActions";
import { SearchBar } from "../../components/ui/SearchBar";
import { UserTable } from "../../components/ui/UserTable";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { usePaginatedUsers } from "../../utils/usePaginatedUsers";
import { RiArrowLeftLine } from "react-icons/ri";
import { FiPlus, FiX } from "react-icons/fi";

interface ProjectTeamStepProps {
    selectedUserIds: number[];
    onToggleUser?: (userId: number) => void;
    onBack: () => void;
    onConfirm?: () => void;
    isSubmitting?: boolean;
    mode: "create" | "edit" | "view";
}

export function ProjectTeamStep({
    selectedUserIds,
    onToggleUser,
    onBack,
    onConfirm,
    isSubmitting,
    mode
}: ProjectTeamStepProps) {
    // Usiamo il nostro nuovo hook! 
    // Filtriamo solo i Developer ("User") attivi.
    const {
        users,
        totalItems,
        isLoading,
        error,
        search,
        setSearch,
        currentPage,
        setCurrentPage
    } = usePaginatedUsers({
        initialRole: "User",
        initialStatus: "Active",
    });

    const isViewMode = mode === "view";
    const [membershipFilter, setMembershipFilter] = useState<string>(isViewMode ? "Added" : "All");

    const filteredUsers = users.filter(user => {
        if (membershipFilter === "Added") return selectedUserIds.includes(user.userId);
        if (membershipFilter === "NotAdded") return !selectedUserIds.includes(user.userId);
        return true;
    });

    return (
        <ProjectFormLayout
            title={isViewMode ? "Team Members" : mode === "create" ? "Select Team Members" : "Manage Team Members"}
            subtitle={isViewMode ? "Members of this project." : "Add developers to your project. Admins always have access."}
            stepInfo={mode === "create" ? "STEP 2 OF 2" : undefined}
            footer={
                <FooterActions
                    isSaveEnabled={isViewMode ? false : selectedUserIds.length > 0}
                    onSave={isViewMode ? undefined : onConfirm}
                    isSaving={isSubmitting}
                    saveLabel={isViewMode ? undefined : mode === "create" ? "Create Project" : "Save Changes"}
                    showSave={!isViewMode}
                    links={[
                        {
                            label: isViewMode ? "Close" : "Back",
                            icon: <RiArrowLeftLine size={16} />,
                            onClick: onBack
                        }
                    ]}
                />
            }
        >
            {/* Search Bar + Select + Selected Count */}
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <SearchBar
                        value={search}
                        onChange={setSearch}
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

                {/* Pagination inside the container */}
                {totalItems > 0 && !isLoading && !error && (
                    <div className="border-t border-white/5 bg-[#0D0D12]/20">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={10}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

        </ProjectFormLayout >
    );
}
