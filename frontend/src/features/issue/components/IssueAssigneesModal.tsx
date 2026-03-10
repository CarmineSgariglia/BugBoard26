import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RiCloseLine } from "react-icons/ri";

import { updateIssueApi } from "@shared/api/modules/issues";
import { listProjectMembersApi } from "@shared/api/modules/projects";
import type { AuthUser } from "@shared/api/types/auth";
import type { Issue } from "@shared/api/types/issues";
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

  useEffect(() => {
    if (!isOpen) return;
    setSelectedUserIds(issue.assignees.map((a) => a.userId));
    setError("");
  }, [isOpen, issue]);

  const {
    data: projectMembers = [],
    isLoading,
    error: membersError,
  } = useQuery({
    queryKey: ["project", issue.projectId, "members"],
    queryFn: () => listProjectMembersApi(issue.projectId),
    enabled: isOpen,
    staleTime: 0,
  });

  const members = useMemo<AuthUser[]>(() => {
    return projectMembers.map((m) => ({
      userId: m.userId,
      username: m.username,
      email: m.role,
      firstName: m.username,
      profileImg: m.profileImg || undefined,
    }));
  }, [projectMembers]);

  const saveMutation = useMutation({
    mutationFn: () => updateIssueApi(issue.issueId, { assigneeIds: selectedUserIds }),
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
        />
      </ProjectFormLayout>
    </ModalOverlay>
  );
}
