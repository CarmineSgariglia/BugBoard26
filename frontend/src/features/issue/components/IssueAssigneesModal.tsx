import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RiCloseLine } from "react-icons/ri";

import {
  assignIssueUsersApi,
  getIssueApi,
  listIssueSuggestionsApi,
  unassignIssueUsersApi,
} from "@shared/api/modules/issues";
import { listProjectMembersApi } from "@shared/api/modules/projects";
import type { AuthUser } from "@shared/api/types/auth";
import type { Issue, IssueSuggestion } from "@shared/api/types/issues";
import { isAdminLike } from "@shared/lib";
import { FooterActions } from "@shared/ui/FooterActions";
import { UserSelectorTable } from "@shared/ui/UserSelectorTable";
import { ModalOverlay } from "@widgets/layout/ModalOverlay";
import { ProjectFormLayout } from "@widgets/layout/ProjectFormLayout";

interface IssueAssigneesModalProps {
  issue: Issue;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedIssue: Issue) => void;
  readOnly?: boolean;
}

export function IssueAssigneesModal({
  issue,
  isOpen,
  onClose,
  onSuccess,
  readOnly = false,
}: IssueAssigneesModalProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const {
    data: projectMembers = [],
    isLoading: isMembersLoading,
    error: membersError,
  } = useQuery({
    queryKey: ["project", issue.projectId, "members"],
    queryFn: () => listProjectMembersApi(issue.projectId),
    enabled: isOpen,
    staleTime: 0,
  });

  const {
    data: suggestions = [],
    isLoading: isSuggestionsLoading,
  } = useQuery<IssueSuggestion[]>({
    queryKey: ["issue", issue.issueId, "suggestions"],
    queryFn: () => listIssueSuggestionsApi(issue.issueId),
    enabled: isOpen,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isOpen) return;
    const allowedIds = new Set(
      projectMembers
        .filter((m) => !isAdminLike({ role: m.role }))
        .map((m) => m.userId)
    );
    const initialIds = issue.assignees
      .map((a) => a.userId)
      .filter((id) => (allowedIds.size ? allowedIds.has(id) : true));

    setSelectedUserIds(initialIds);
    setError("");
  }, [isOpen, issue, projectMembers]);

  const members = useMemo<AuthUser[]>(() => {
    return projectMembers
      .map((m) => ({
        userId: m.userId,
        username: m.username,
        email: m.email ?? "",
        firstName: m.firstName ?? "",
        lastName: m.lastName ?? "",
        profileImg: m.profileImg || undefined,
        isAdmin: isAdminLike({ role: m.role }),
      }))
      .filter((m) => !m.isAdmin);
  }, [projectMembers]);

  const suggestedMetaByUserId = useMemo(() => {
    const map: Record<number, { openAssignments: number; suggestionScore?: number; rank: number }> = {};
    suggestions.forEach((suggestion, index) => {
      map[suggestion.userId] = {
        openAssignments: suggestion.openAssignments ?? 0,
        suggestionScore: suggestion.suggestionScore,
        rank: index,
      };
    });
    return map;
  }, [suggestions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allowed = new Set(members.map((m) => m.userId));
      const previousIds = issue.assignees.map((a) => a.userId).filter((id) => allowed.has(id));
      const nextIds = selectedUserIds.filter((id) => allowed.has(id));

      const added = nextIds.filter((id) => !previousIds.includes(id));
      const removed = previousIds.filter((id) => !nextIds.includes(id));

      if (added.length > 0) {
        await assignIssueUsersApi(issue.issueId, added);
      }

      if (removed.length > 0) {
        await unassignIssueUsersApi(issue.issueId, removed);
      }

      return getIssueApi(issue.issueId);
    },
    onSuccess: (updatedIssue) => {
      onSuccess(updatedIssue);
      onClose();
    },
    onError: () => {
      setError("Failed to update assignees.");
    },
  });

  const handleToggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setError("");
    await saveMutation.mutateAsync();
  };

  const isLoading = isMembersLoading || isSuggestionsLoading;
  const uiError = error || (membersError ? "Failed to load project members." : "");

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <ProjectFormLayout
        title={readOnly ? "Team Members" : "Manage Assignees"}
        subtitle={
          readOnly
            ? `Members for issue #${issue.issueId}`
            : `Assign team members to issue #${issue.issueId}`
        }
        footer={
          <FooterActions
            isSaveEnabled={!readOnly}
            onSave={readOnly ? undefined : handleSave}
            isSaving={readOnly ? false : saveMutation.isPending}
            saveLabel={readOnly ? undefined : "Save Changes"}
            showSave={!readOnly}
            links={[{ label: "Cancel", icon: <RiCloseLine size={16} />, onClick: onClose }]}
          />
        }
      >
        <UserSelectorTable
          users={members}
          selectedUserIds={selectedUserIds}
          onToggleUser={readOnly ? undefined : handleToggleUser}
          isLoading={isLoading}
          error={uiError}
          search={search}
          onSearchChange={setSearch}
          isViewMode={readOnly}
          enableSuggestedFilter
          suggestedMetaByUserId={suggestedMetaByUserId}
        />
      </ProjectFormLayout>
    </ModalOverlay>
  );
}
