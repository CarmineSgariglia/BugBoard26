import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getIssueApi, type Issue } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useBreadcrumbs } from "../../contexts/BreadcrumbContext";
import { SidebarLayout } from "../../components/layout/SidebarLayout";
import { IssueDetailsSidebar } from "./IssueDetailsSidebar";
import { IssueAssigneesModal } from "./IssueAssigneesModal";
import { IssueModal } from "./IssueModal";

export function IssuePage() {
    const { issueId } = useParams();
    const { user: currentUser } = useAuth(); // Prendiamo l'utente loggato
    const { setLabel } = useBreadcrumbs();
    const [issue, setIssue] = useState<Issue | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAssigneesModalOpen, setIsAssigneesModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (issueId) {
            getIssueApi(issueId)
                .then(data => {
                    setIssue(data);
                    setLabel(issueId, data.title);
                })
                .finally(() => setIsLoading(false));
        }
    }, [issueId, setLabel]);


    const isAssigned = useMemo(() => {
        if (!issue || !currentUser) return false;
        return issue.assignees.some(a => a.userId === currentUser.userId);
    }, [issue, currentUser]);

    if (isLoading) return <div className="pt-24 px-6 text-white text-center">Loading issue...</div>;
    if (!issue) return <div className="pt-24 px-6 text-white text-center">Issue not found</div>;

    return (
        <div className="pt-24 pb-12 px-6">
            <SidebarLayout
                sidebar={
                    <IssueDetailsSidebar
                        issue={issue}
                        isAdmin={currentUser?.isAdmin}
                        isAssigned={isAssigned}
                        onEditClick={() => setIsModalOpen(true)}
                        onManageMembersClick={() => setIsAssigneesModalOpen(true)}
                    />
                }
            >
                <div className="rounded-2xl border border-white/5 bg-[#121620]/20 p-8 min-h-[500px]">
                    <h3 className="text-xl font-bold text-white mb-6">Activity Feed</h3>
                    <p className="text-neutral-500 italic">Buonasera caro</p>
                </div>
            </SidebarLayout>
            <IssueAssigneesModal
                issue={issue}
                isOpen={isAssigneesModalOpen}
                onClose={() => setIsAssigneesModalOpen(false)}
                onSuccess={(updatedIssue) => setIssue(updatedIssue)}
            />
            <IssueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                mode="edit"
            />
        </div>
    );
}
