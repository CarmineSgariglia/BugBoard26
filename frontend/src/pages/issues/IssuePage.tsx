import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { IssueAssigneesModal } from "@features/issue/components/IssueAssigneesModal";
import { IssueDetailsSidebar } from "@features/issue/components/IssueDetailsSidebar";
import { IssueModal } from "@features/issue/components/IssueModal";
import { getIssueApi } from "@shared/api/modules/issues";
import { useAuth } from "@shared/providers/AuthContext";
import { useBreadcrumbs } from "@shared/providers/BreadcrumbContext";
import { SidebarLayout } from "@widgets/layout/SidebarLayout";

export function IssuePage() {
  const { issueId } = useParams();
  const { user: currentUser } = useAuth();
  const { setLabel } = useBreadcrumbs();

  const [isAssigneesModalOpen, setIsAssigneesModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: issue, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["issue", issueId],
    queryFn: () => getIssueApi(issueId!),
    enabled: !!issueId,
    staleTime: 0,
  });

  const isRefreshing = isFetching && !isLoading;

  const numericIssueId = issueId ? Number(issueId) : Number.NaN;
  const safeIssue = issue && issue.issueId === numericIssueId ? issue : null;

  useEffect(() => {
    if (issueId && safeIssue) {
      setLabel(`issue:${issueId}`, safeIssue.title);
    }
  }, [issueId, safeIssue, setLabel]);

  const isAssigned = useMemo(() => {
    if (!safeIssue || !currentUser) return false;
    return safeIssue.assignees.some((a) => a.userId === currentUser.userId);
  }, [safeIssue, currentUser]);

  if (isLoading || !safeIssue) {
    return <div className="pt-24 px-6 text-white text-center">Loading issue...</div>;
  }

  return (
    <div className="pt-24 pb-12 px-6">
      <SidebarLayout
        sidebar={
          <IssueDetailsSidebar
            issue={safeIssue}
            isAdmin={currentUser?.isAdmin}
            isAssigned={isAssigned}
            onEditClick={() => setIsModalOpen(true)}
            onManageMembersClick={() => setIsAssigneesModalOpen(true)}
          />
        }
      >
        <div className="rounded-2xl border border-white/5 bg-[#121620]/20 p-8 min-h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Activity Feed</h3>
            {isRefreshing ? <span className="text-xs text-neutral-500">Refreshing...</span> : null}
          </div>
          <p className="text-neutral-500 italic">Activity updates will appear here.</p>
        </div>
      </SidebarLayout>

      <IssueAssigneesModal
        issue={safeIssue}
        readOnly={!currentUser?.isAdmin}
        isOpen={isAssigneesModalOpen}
        onClose={() => setIsAssigneesModalOpen(false)}
        onSuccess={() => {
          void refetch();
        }}
      />

      <IssueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="edit"
        issue={safeIssue}
        initialData={safeIssue}
        onSuccess={async () => {
          setIsModalOpen(false);
          await refetch();
        }}
      />
    </div>
  );
}
