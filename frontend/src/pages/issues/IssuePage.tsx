import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import {
  getIssueSubscriptionApi,
  IssueActivityPanel,
  IssueAssigneesModal,
  IssueDetailsSidebar,
  IssueModal,
  subscribeToIssueApi,
  unsubscribeFromIssueApi,
} from "@features/issue";
import { getIssueApi } from "@features/issue/api";
import { getProjectSubscriptionApi, listProjectMembersApi } from "@features/project/api";
import type { IssueSubscriptionState } from "@shared/api/types/issues";
import type { ProjectMembership } from "@shared/api/types/projects";
import { isAdminLike } from "@shared/lib";
import { useAuth } from "@features/auth";
import { useBreadcrumbs } from "@shared/providers/BreadcrumbContext";
import { SidebarLayout } from "@widgets/layout/SidebarLayout";
import { isProjectAccessRevokedError, revokeProjectAccess } from "@features/project/lib/accessRevocation";

export function IssuePage() {
  const navigate = useNavigate();
  const { issueId, projectId } = useParams();
  const { user: currentUser } = useAuth();
  const { setLabel } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.isAdmin === true;

  const [isAssigneesModalOpen, setIsAssigneesModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");

  const { data: issue, isLoading, error: issueError, refetch } = useQuery({
    queryKey: ["issue", issueId],
    queryFn: () => getIssueApi(issueId!),
    enabled: !!issueId,
    staleTime: 0,
  });

  const numericIssueId = issueId ? Number(issueId) : Number.NaN;
  const safeIssue = issue && issue.issueId === numericIssueId ? issue : null;
  const subscriptionQueryKey = ["issue", issueId, "subscription"] as const;

  const { data: projectMembers = [], error: projectMembersError } = useQuery({
    queryKey: ["project", safeIssue?.projectId, "members"],
    queryFn: () => listProjectMembersApi(safeIssue!.projectId),
    enabled: Boolean(safeIssue?.projectId),
    staleTime: 0,
  });

  const {
    data: projectSubscription = null,
    isLoading: isProjectSubscriptionLoading,
    error: projectSubscriptionError,
  } = useQuery({
    queryKey: ["project", safeIssue?.projectId, "subscription"],
    queryFn: () => getProjectSubscriptionApi(safeIssue!.projectId),
    enabled: Boolean(safeIssue?.projectId) && isAdmin,
    staleTime: 0,
  });

  const isProjectSubscriptionEnabled = !isAdmin || projectSubscription?.subscribed !== false;

  const {
    data: subscription = null,
    isLoading: isSubscriptionLoading,
    error: subscriptionQueryError,
  } = useQuery({
    queryKey: subscriptionQueryKey,
    queryFn: () => getIssueSubscriptionApi(issueId!),
    enabled:
      !!issueId &&
      isAdmin &&
      !isProjectSubscriptionLoading &&
      isProjectSubscriptionEnabled,
    staleTime: 0,
  });

  const subscriptionMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      if (!issueId) {
        throw new Error("Missing issue id");
      }

      if (checked) {
        await subscribeToIssueApi(issueId);
        return { subscribed: true } satisfies IssueSubscriptionState;
      }

      await unsubscribeFromIssueApi(issueId);
      return { subscribed: false } satisfies IssueSubscriptionState;
    },
    onMutate: async (checked) => {
      setSubscriptionError("");
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });
      const previous = queryClient.getQueryData<IssueSubscriptionState>(subscriptionQueryKey);
      queryClient.setQueryData<IssueSubscriptionState>(subscriptionQueryKey, {
        subscribed: checked,
      });
      return { previous };
    },
    onError: (_error, _checked, context) => {
      if (context?.previous) {
        queryClient.setQueryData(subscriptionQueryKey, context.previous);
      }
      setSubscriptionError("Unable to update notification preference. Please try again.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
    },
  });

  useEffect(() => {
    if (issueId && safeIssue) {
      setLabel(`issue:${issueId}`, safeIssue.title);
    }
  }, [issueId, safeIssue, setLabel]);

  useEffect(() => {
    const numericProjectId = Number(projectId ?? safeIssue?.projectId);
    if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
      return;
    }

    const accessRevoked =
      isProjectAccessRevokedError(issueError) ||
      isProjectAccessRevokedError(projectMembersError) ||
      isProjectAccessRevokedError(projectSubscriptionError);

    if (!accessRevoked) {
      return;
    }

    revokeProjectAccess(queryClient, numericProjectId);
    navigate("/projects", { replace: true });
  }, [
    issueError,
    navigate,
    projectId,
    projectMembersError,
    projectSubscriptionError,
    queryClient,
    safeIssue?.projectId,
  ]);

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
  const issueSubscriptionBlockedByProject =
    isAdmin &&
    Boolean(safeIssue) &&
    !isProjectSubscriptionLoading &&
    projectSubscription?.subscribed === false;
  const shouldShowSubscriptionLoadError =
    Boolean(subscriptionQueryError) && !issueSubscriptionBlockedByProject;

  if (isLoading || !safeIssue) {
    return <div className="pt-24 px-6 text-white text-center">Loading issue...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col pt-24 pb-6 px-6 lg:min-h-dvh">
      <SidebarLayout
        className="flex-1 min-h-0"
        gridClassName="items-stretch"
        sidebar={
          <IssueDetailsSidebar
            issue={safeIssue}
            assignees={visibleAssignees}
            isAdmin={isAdmin}
            isAssigned={isAssigned}
            onEditClick={() => setIsModalOpen(true)}
            onManageMembersClick={() => setIsAssigneesModalOpen(true)}
            subscriptionChecked={subscription?.subscribed ?? false}
            subscriptionDisabled={
              isSubscriptionLoading ||
              isProjectSubscriptionLoading ||
              subscriptionMutation.isPending ||
              !subscription ||
              issueSubscriptionBlockedByProject
            }
            subscriptionDisabledReason={
              issueSubscriptionBlockedByProject ? "Project notifications disabled" : ""
            }
            subscriptionError={
              subscriptionError ||
              (shouldShowSubscriptionLoadError ? "Unable to load notification preference." : "")
            }
            onSubscriptionChange={(checked) => {
              void subscriptionMutation.mutateAsync(checked).catch(() => {
                // Error state is surfaced inline in the sidebar.
              });
            }}
          />
        }
      >
        <div className="min-h-[40rem] lg:h-[calc(100dvh-8.5rem)]">
          <IssueActivityPanel
            issueId={safeIssue.issueId}
            issueTitle={safeIssue.title}
            currentUser={currentUser}
            projectMembers={projectMembers}
            canCompose={canCompose}
            className="h-full"
          />
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
