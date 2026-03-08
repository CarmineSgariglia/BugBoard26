import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getIssueApi, listIssueUpdatesApi, resolveMediaUrl, type Issue, type IssueUpdate } from "../../services/api";
import { useAuth } from "../../contexts/useAuth";
import { useBreadcrumbs } from "../../contexts/useBreadcrumbs";
import { SidebarLayout } from "../../components/layout/SidebarLayout";
import { IssueDetailsSidebar } from "./IssueDetailsSidebar";
import { IssueAssigneesModal } from "./IssueAssigneesModal";
import { IssueModal } from "./IssueModal";

function eventLabel(update: IssueUpdate): string {
    switch (update.eventType) {
        case "CREATE":
            return "created this issue";
        case "EDIT":
            return "updated the issue";
        case "STATUS_CHANGE":
            return update.newStatus
                ? `changed status to ${update.newStatus.replaceAll("_", " ")}`
                : "changed the issue status";
        case "ASSIGN":
            return "updated assignees";
        case "UNASSIGN":
            return "removed assignees";
        case "COMMENT":
            return "commented on this issue";
        default:
            return update.eventType.replaceAll("_", " ").toLowerCase();
    }
}

export function IssuePage() {
    const { issueId } = useParams();
    const { user: currentUser } = useAuth();
    const { setLabel } = useBreadcrumbs();
    const [issue, setIssue] = useState<Issue | null>(null);
    const [updates, setUpdates] = useState<IssueUpdate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [isAssigneesModalOpen, setIsAssigneesModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchIssueDetails = useCallback(async () => {
        if (!issueId) {
            setError("Missing issue id");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError("");
        try {
            const [issueData, updatesData] = await Promise.all([
                getIssueApi(issueId),
                listIssueUpdatesApi(issueId),
            ]);
            setIssue(issueData);
            setUpdates(updatesData);
            setLabel(`issue:${issueId}`, issueData.title);
        } catch {
            setIssue(null);
            setUpdates([]);
            setError("Unable to load issue details.");
        } finally {
            setIsLoading(false);
        }
    }, [issueId, setLabel]);

    useEffect(() => {
        fetchIssueDetails();
    }, [fetchIssueDetails]);


    const isAssigned = useMemo(() => {
        if (!issue || !currentUser) return false;
        return issue.assignees.some(a => a.userId === currentUser.userId);
    }, [issue, currentUser]);

    if (isLoading) return <div className="pt-24 px-6 text-white text-center">Loading issue...</div>;
    if (!issue) return <div className="pt-24 px-6 text-white text-center">{error || "Issue not found"}</div>;

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
                    {error ? (
                        <p className="text-sm text-rose-400">{error}</p>
                    ) : null}
                    {updates.length === 0 ? (
                        <p className="text-neutral-500 italic">No activity yet.</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {updates.map((update) => (
                                <article
                                    key={update.updateId}
                                    className="rounded-2xl border border-white/5 bg-black/10 p-4"
                                >
                                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                        <p className="text-sm font-medium text-white">
                                            <span className="text-cyan-300">{update.actorUsername}</span>{" "}
                                            {eventLabel(update)}
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            {new Date(update.at).toLocaleString()}
                                        </p>
                                    </div>
                                    {update.message ? (
                                        <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-200">
                                            {update.message}
                                        </p>
                                    ) : null}
                                    {update.oldStatus || update.newStatus ? (
                                        <p className="mt-3 text-xs text-neutral-400">
                                            {update.oldStatus ? update.oldStatus.replaceAll("_", " ") : "Unknown"}{" "}
                                            →{" "}
                                            {update.newStatus ? update.newStatus.replaceAll("_", " ") : "Unknown"}
                                        </p>
                                    ) : null}
                                    {update.attachments.length > 0 ? (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {update.attachments.map((attachment) => (
                                                <a
                                                    key={attachment.attachmentId}
                                                    href={resolveMediaUrl(attachment.url || attachment.path)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-cyan-200 hover:bg-white/10"
                                                >
                                                    {attachment.path.split("/").pop() || `Attachment #${attachment.attachmentId}`}
                                                </a>
                                            ))}
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
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
                issue={issue}
                initialData={issue}
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchIssueDetails();
                }}
            />
        </div>
    );
}
