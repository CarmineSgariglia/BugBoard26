import { useState } from "react";
import { ProjectFormLayout } from "../../components/layout/ProjectFormLayout";
import { FooterActions } from "../../components/ui/FooterActions";
import { SearchBar } from "../../components/ui/SearchBar";
import { UserTable } from "../../components/ui/UserTable";
import { Pagination } from "../../components/ui/Pagination";
import { usePaginatedUsers } from "../../utils/usePaginatedUsers";
import { RiArrowLeftLine, RiUserAddLine, RiUserLine } from "react-icons/ri";
import { FiCheck, FiPlus } from "react-icons/fi";
import { type AuthUser } from "../../services/api";

interface ProjectTeamStepProps {
    selectedUserIds: number[];
    onToggleUser: (userId: number) => void;
    onBack: () => void;
    onConfirm: () => void;
    isSubmitting: boolean;
    mode: "create" | "edit";
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

    return (
        <ProjectFormLayout
            title={mode === "create" ? "Select Team Members" : "Manage Team Members"}
            subtitle="Add developers to your project. Admins always have access."
            stepInfo={mode === "create" ? "STEP 2 OF 2" : undefined}
            footer={
                <FooterActions
                    isSaveEnabled={selectedUserIds.length > 0}
                    onSave={onConfirm}
                    isSaving={isSubmitting}
                    saveLabel={mode === "create" ? "Create Project" : "Save Changes"}
                    links={[
                        {
                            label: "Back",
                            icon: <RiArrowLeftLine size={16} />,
                            onClick: onBack
                        }
                    ]}
                />
            }
        >
            {/* Search Bar + Selected Count */}
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
                <span className="bg-[#5671F6]/20 text-[#5671F6] px-3 py-1.5 rounded-full border border-[#5671F6]/30 text-xs font-bold whitespace-nowrap">
                    {selectedUserIds.length} selected
                </span>
            </div>


            {/* User Table Wrapper */}
            <div className="flex-1 min-h-0 border border-white/5 bg-[#121620]/30 rounded-xl overflow-hidden flex flex-col">
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    <UserTable
                        users={users}
                        isLoading={isLoading}
                        error={error}
                        showStatus={false}
                        showRole={false}
                        renderActions={(user) => {
                            const isSelected = selectedUserIds.includes(user.userId);
                            return (
                                <button
                                    onClick={() => onToggleUser(user.userId)}
                                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                        : "bg-[#5671F6]/10 text-[#5671F6] border border-[#5671F6]/20 hover:bg-[#5671F6]/20"
                                        }`}
                                >
                                    {isSelected ? (
                                        <>
                                            <FiCheck size={14} />
                                            Selected
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
