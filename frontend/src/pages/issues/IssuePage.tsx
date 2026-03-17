import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  IssueActivityPanel,
  IssueAssigneesModal,
  IssueDetailsSidebar,
  IssueModal,
} from "@features/issue";
import { getIssueApi } from "@features/issue/api";
import { listProjectMembersApi } from "@features/project/api";
import type { ProjectMembership } from "@shared/api/types/projects";
import { isAdminLike } from "@shared/lib";
import { useAuth } from "@features/auth";
import { useBreadcrumbs } from "@shared/providers/BreadcrumbContext";
import { SidebarLayout } from "@widgets/layout/SidebarLayout";

export function IssuePage() {
  const { issueId } = useParams();
  const { user: currentUser } = useAuth();
  const { setLabel } = useBreadcrumbs();
  const queryClient = useQueryClient();

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

  const { data: projectMembers = [] } = useQuery({
    queryKey: ["project", safeIssue?.projectId, "members"],
    queryFn: () => listProjectMembersApi(safeIssue!.projectId),
    enabled: Boolean(safeIssue?.projectId),
    staleTime: 0,
  });

  useEffect(() => {
    if (issueId && safeIssue) {
      setLabel(`issue:${issueId}`, safeIssue.title);
    }
  }, [issueId, safeIssue, setLabel]);

  const isAssigned = useMemo(() => {
    if (!safeIssue || !currentUser) return false;
    return safeIssue.assignees.some((a) => a.userId === currentUser.userId);
  }, [safeIssue, currentUser]);

  const visibleAssignees = useMemo(() => {
    if (!safeIssue) return [];
    if (!projectMembers.length) return safeIssue.assignees;

    const adminIds = new Set(
      projectMembers
        .filter((member: ProjectMembership) => isAdminLike({ role: member.role }))
        .map((member: ProjectMembership) => member.userId)
    );

    return safeIssue.assignees.filter((assignee) => !adminIds.has(assignee.userId));
  }, [safeIssue, projectMembers]);

  const canCompose = isAssigned || Boolean(currentUser?.isAdmin);

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
            assignees={visibleAssignees}
            isAdmin={currentUser?.isAdmin}
            isAssigned={isAssigned}
            onEditClick={() => setIsModalOpen(true)}
            onManageMembersClick={() => setIsAssigneesModalOpen(true)}
          />
        }
      >
        <div className="h-full">
          <IssueActivityPanel issueId={safeIssue.issueId} issueTitle={safeIssue.title} currentUser={currentUser} canCompose={canCompose} className="h-full" />
        </div>
      </SidebarLayout>

      <IssueAssigneesModal
        issue={safeIssue}
        readOnly={!currentUser?.isAdmin}
        isOpen={isAssigneesModalOpen}
        onClose={() => setIsAssigneesModalOpen(false)}
        onSuccess={async () => {
          await refetch();
          await queryClient.invalidateQueries({ queryKey: ["issue", numericIssueId, "updates"] });
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
          await queryClient.invalidateQueries({ queryKey: ["issue", numericIssueId, "updates"] });
        }}
      />
    </div>
  );
}

