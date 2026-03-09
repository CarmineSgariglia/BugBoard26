import { useState, useEffect } from "react";
import { RiCloseLine } from "react-icons/ri";

import { ModalOverlay } from "../../widgets/layout/ModalOverlay";
import { ProjectFormLayout } from "../../widgets/layout/ProjectFormLayout";
import { FooterActions } from "../../shared/ui/FooterActions";
import { UserSelectorTable } from "../../shared/ui/UserSelectorTable";
import { listProjectMembersApi } from "../../shared/api/modules/projects";
import { updateIssueApi } from "../../shared/api/modules/issues";
import type { AuthUser } from "../../shared/api/types/auth";
import type { Issue } from "../../shared/api/types/issues";

interface IssueAssigneesModalProps {
    issue: Issue;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedIssue: Issue) => void;
}

export function IssueAssigneesModal({ issue, isOpen, onClose, onSuccess }: IssueAssigneesModalProps) {
    const [members, setMembers] = useState<AuthUser[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            setSelectedUserIds(issue.assignees.map((a) => a.userId));
            fetchMembers();
        }
    }, [isOpen, issue]);

    const fetchMembers = async () => {
        try {
            setIsLoading(true);
            const data = await listProjectMembersApi(issue.projectId);

            const mappedUsers: AuthUser[] = data.map((m) => ({
                userId: m.userId,
                username: m.username,
                email: m.role,
                firstName: m.username,
                profileImg: m.profileImg || undefined,
            }));
            setMembers(mappedUsers);
        } catch {
            setError("Failed to load project members.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleUser = (userId: number) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleSave = async () => {
        try {
            setIsSubmitting(true);
            const updated = await updateIssueApi(issue.issueId, { assigneeIds: selectedUserIds });
            onSuccess(updated);
            onClose();
        } catch {
            setError("Failed to update assignees.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <ModalOverlay isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
            <ProjectFormLayout
                title="Manage Assignees"
                subtitle={`Assign team members to issue #${issue.issueId}`}
                footer={
                    <FooterActions
                        isSaveEnabled
                        onSave={handleSave}
                        isSaving={isSubmitting}
                        saveLabel="Save Changes"
                        links={[{ label: "Cancel", icon: <RiCloseLine size={16} />, onClick: onClose }]}
                    />
                }
            >
                <UserSelectorTable
                    users={members}
                    selectedUserIds={selectedUserIds}
                    onToggleUser={handleToggleUser}
                    isLoading={isLoading}
                    error={error}
                    search={search}
                    onSearchChange={setSearch}
                />
            </ProjectFormLayout>
        </ModalOverlay>
    );
}
