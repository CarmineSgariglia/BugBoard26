import { useState, useEffect, useCallback } from "react";
import { ModalOverlay } from "../../components/layout/ModalOverlay";
import { ProjectFormLayout } from "../../components/layout/ProjectFormLayout";
import { FooterActions } from "../../components/ui/FooterActions";
import { UserSelectorTable } from "../../components/ui/UserSelectorTable";
import { listProjectMembersApi, updateIssueApi, type AuthUser, type Issue } from "../../services/api";

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

    const fetchMembers = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await listProjectMembersApi(issue.projectId);

            // "Trucchetto": Mappiamo ProjectMembership in AuthUser così UserSelectorTable è felice
            const mappedUsers: AuthUser[] = data.map(m => ({
                userId: m.userId,
                username: m.username,
                email: m.role, // Mostrerà "Admin" o "Developer" nella colonna email!
                firstName: m.username, // Forza a mostrare l'username come nome principale
                profileImg: m.profileImg || undefined,
            }));
            setMembers(mappedUsers);
        } catch {
            setError("Failed to load project members.");
        } finally {
            setIsLoading(false);
        }
    }, [issue.projectId]);

    useEffect(() => {
        if (isOpen) {
            setSelectedUserIds(issue.assignees.map(a => a.userId));
            void fetchMembers();
        }
    }, [fetchMembers, isOpen, issue]);

    const handleToggleUser = (userId: number) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
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
                        isSaveEnabled={true}
                        onSave={handleSave}
                        isSaving={isSubmitting}
                        saveLabel="Save Changes"
                        links={[{ label: "Cancel", onClick: onClose }]}
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
