import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  IssueActivityPanel,
  IssueAssigneesModal,
  IssueDetailsSidebar,
  IssueModal,
} from "@features/issue/components";
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

  const { data: issue, isLoading, refetch } = useQuery({
    queryKey: ["issue", issueId],
    queryFn: () => getIssueApi(issueId!),
    enabled: !!issueId,
    staleTime: 0,
  });


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
    <div className="h-screen overflow-hidden flex flex-col pt-24 pb-6 px-6">
      <SidebarLayout
        className="flex-1 min-h-0"
        gridClassName="items-stretch h-full"
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
        <div className="h-full">
          <IssueActivityPanel issueId={safeIssue.issueId} currentUser={currentUser} className="h-full" />
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



