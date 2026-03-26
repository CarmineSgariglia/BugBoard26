import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { ProjectDetailsStep, type ProjectDetailsData } from "./ProjectDetailsStep";
import { ProjectTeamStep } from "./ProjectTeamStep";
import { createProjectApi } from "@features/project/api";
import { useToast } from "@shared/providers";
import { InlineFeedbackMessage } from "@shared/ui";
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
  const { pushSuccessToast } = useToast();

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
      pushSuccessToast("Project created successfully.");
      onSuccess?.();
      onClose();
    },
    onError: () => {
      setError("Error creating project.");
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
      setError("Missing project data.");
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

        {error ? <InlineFeedbackMessage message={error} className="mx-8 mb-4 text-center" /> : null}

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
