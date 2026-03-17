import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { ProjectDetailsStep, type ProjectDetailsData } from "./ProjectDetailsStep";
import { ProjectTeamStep } from "./ProjectTeamStep";
import { createProjectApi } from "@shared/api/modules/projects";
import { ModalOverlay } from "@widgets/layout/ModalOverlay";

interface CreateProjectFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateProjectFlow({ isOpen, onClose, onSuccess }: CreateProjectFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [projectData, setProjectData] = useState<ProjectDetailsData | null>(null);
  const [error, setError] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const createProjectMutation = useMutation({
    mutationFn: async ({ data, team }: { data: ProjectDetailsData; team: number[] }) => {
      await createProjectApi({
        name: data.title,
        description: data.description,
        icon: data.icon,
        color: data.color,
        team,
      });
    },
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onError: () => {
      setError("Errore durante la creazione del progetto");
    },
  });

  const handleStep1Next = (data: ProjectDetailsData) => {
    setProjectData(data);
    setCurrentStep(2);
  };

  const handleStep2Back = () => {
    setCurrentStep(1);
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev: number[]) =>
      prev.includes(userId) ? prev.filter((id: number) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateProject = () => {
    if (!projectData) {
      setError("Error: Project data is missing.");
      return;
    }

    setError("");
    createProjectMutation.mutate({ data: projectData, team: selectedUserIds });
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="relative">
        {currentStep === 1 ? (
          <ProjectDetailsStep
            mode="create"
            initialData={projectData || undefined}
            onNext={handleStep1Next}
            onExit={onClose}
          />
        ) : null}

        {error ? (
          <div className="mx-8 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center">
            {error}
          </div>
        ) : null}

        {currentStep === 2 ? (
          <ProjectTeamStep
            mode="create"
            selectedUserIds={selectedUserIds}
            onToggleUser={toggleUser}
            onBack={handleStep2Back}
            onConfirm={handleCreateProject}
            isSubmitting={createProjectMutation.isPending}
          />
        ) : null}
      </div>
    </ModalOverlay>
  );
}
