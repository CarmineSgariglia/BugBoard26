import { useState } from "react";
import { ProjectFormLayout } from "../../widgets/layout/ProjectFormLayout";
import { FooterActions } from "../../shared/ui/FooterActions";
import { UserSelectorTable } from "../../shared/ui/UserSelectorTable";
import { usePaginatedUsers } from "../../shared/hooks/usePaginatedUsers";
import { RiArrowLeftLine } from "react-icons/ri";

interface ProjectTeamStepProps {
    selectedUserIds: number[];
    onToggleUser?: (userId: number) => void;
    onBack: () => void;
    onConfirm?: () => void;
    isSubmitting?: boolean;
    mode: "create" | "edit" | "view";
}

export function ProjectTeamStep({ selectedUserIds, onToggleUser, onBack, onConfirm, isSubmitting, mode }: ProjectTeamStepProps) {
    const isViewMode = mode === "view";
    const [membershipFilter, setMembershipFilter] = useState<string>(isViewMode ? "Added" : "All");

    const { users, totalItems, isLoading, error, search, setSearch, currentPage, setCurrentPage } = usePaginatedUsers({
        initialRole: "User",
        initialStatus: "Active",
        userIds: membershipFilter === "Added" ? selectedUserIds : undefined,
        excludeUserIds: membershipFilter === "NotAdded" ? selectedUserIds : undefined,
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
            <UserSelectorTable
                users={users}
                selectedUserIds={selectedUserIds}
                onToggleUser={onToggleUser}
                isLoading={isLoading}
                error={error}
                isViewMode={isViewMode}
                currentPage={currentPage}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                search={search}
                onSearchChange={setSearch}
                onMembershipFilterChange={setMembershipFilter}
            />
        </ProjectFormLayout>
    );
}
