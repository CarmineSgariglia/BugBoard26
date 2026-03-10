import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ProjectTeamStep } from "./ProjectTeamStep";
import { updateProjectApi, listProjectMembersApi } from "../../shared/api/modules/projects";
import type { Project } from "../../shared/api/types/projects";
import { ModalOverlay } from "../../widgets/layout/ModalOverlay";

interface EditTeamFlowProps {
  project: Project;
  onClose: () => void;
  onUpdated?: () => void;
  readOnly?: boolean;
}

export function EditTeamFlow({
  project,
  onClose,
  onUpdated,
  readOnly = false,
}: EditTeamFlowProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [adminIds, setAdminIds] = useState<number[]>([]);
  const [error, setError] = useState("");

  const {
    data: members = [],
    isLoading: isLoadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: ["project", project.projectId, "members"],
    queryFn: () => listProjectMembersApi(project.projectId),
    staleTime: 0,
  });

  useEffect(() => {
    const admins = members.filter((m) => m.role === "Admin").map((m) => m.userId);
    const devs = members.filter((m) => m.role !== "Admin").map((m) => m.userId);
    setAdminIds(admins);
    setSelectedUserIds(devs);
  }, [members, project.projectId]);

  const updateTeamMutation = useMutation({
    mutationFn: () =>
      updateProjectApi(project.projectId, {
        team: [...adminIds, ...selectedUserIds],
      }),
    onSuccess: () => {
      onUpdated?.();
      onClose();
    },
    onError: () => {
      setError("Error updating the team. Please try again.");
    },
  });

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleUpdateTeam = async () => {
    setError("");
    await updateTeamMutation.mutateAsync();
  };

  const uiError =
    error || (membersError ? "Error loading team members." : "");

  return (
    <ModalOverlay isOpen={true} onClose={onClose}>
      <div className="relative">
        {uiError ? (
          <div className="absolute top-0 left-0 right-0 -translate-y-full mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center py-2">
            {uiError}
          </div>
        ) : null}

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
            isSubmitting={readOnly ? false : updateTeamMutation.isPending}
          />
        )}
      </div>
    </ModalOverlay>
  );
}
