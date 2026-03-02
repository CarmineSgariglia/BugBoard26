import { useEffect, useState } from "react";
import { ProjectTeamStep } from "./ProjectTeamStep";
import { updateProjectApi, listProjectMembersApi, type Project } from "../../services/api";
import { ModalOverlay } from "../../components/layout/ModalOverlay";

interface EditTeamFlowProps {
    project: Project;
    onClose: () => void;
    onUpdated?: () => void;
    readOnly?: boolean;
}

export function EditTeamFlow({ project, onClose, onUpdated, readOnly = false }: EditTeamFlowProps) {
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [adminIds, setAdminIds] = useState<number[]>([]); // To keep admins in the project
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const members = await listProjectMembersApi(project.projectId);
                // Separate Admins from Developers
                const admins = members.filter(m => m.role === 'Admin').map(m => m.userId);
                const devs = members.filter(m => m.role !== 'Admin').map(m => m.userId);

                setAdminIds(admins);
                setSelectedUserIds(devs);
            } catch (err) {
                console.error("Error fetching project members:", err);
                setError("Error loading team members.");
            } finally {
                setIsLoadingMembers(false);
            }
        };

        fetchMembers();
    }, [project.projectId]);

    const toggleUser = (userId: number) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleUpdateTeam = async () => {
        setIsSubmitting(true);
        setError("");

        try {
            await updateProjectApi(project.projectId, {
                // Merge admins back with newly selected devs
                team: [...adminIds, ...selectedUserIds]
            });

            if (onUpdated) {
                onUpdated();
            }
            onClose();
        } catch (err) {
            setError("Error updating the team. Please try again.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalOverlay isOpen={true} onClose={onClose}>
            <div className="relative">
                {error && (
                    <div className="absolute top-0 left-0 right-0 -translate-y-full mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center py-2">
                        {error}
                    </div>
                )}

                {isLoadingMembers ? (
                    <div className="bg-[#121620] border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 min-w-[500px]">
                        <div className="w-10 h-10 border-4 border-[#5671F6]/20 border-t-[#5671F6] rounded-full animate-spin" />
                        <p className="text-neutral-400 text-sm">Loading team members...</p>
                    </div>
                ) : (
                    <ProjectTeamStep
                        mode={readOnly ? "view" : "edit"}
                        selectedUserIds={selectedUserIds}
                        onToggleUser={readOnly ? undefined : toggleUser}
                        onBack={onClose}
                        onConfirm={readOnly ? undefined : handleUpdateTeam}
                        isSubmitting={readOnly ? false : isSubmitting}
                    />
                )}
            </div>
        </ModalOverlay>
    );
}
