import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { ProjectDetailsStep, type ProjectDetailsData } from "./ProjectDetailsStep";
import { updateProjectApi } from "../../shared/api/modules/projects";
import type { Project } from "../../shared/api/types/projects";
import { ModalOverlay } from "../../components/layout/ModalOverlay";

interface EditProjectFlowProps {
  project: Project;
  onClose: () => void;
  onUpdated?: (updatedProject: Project) => void;
}

export function EditProjectFlow({ project, onClose, onUpdated }: EditProjectFlowProps) {
  const [error, setError] = useState("");

  const updateProjectMutation = useMutation({
    mutationFn: (data: ProjectDetailsData) =>
      updateProjectApi(project.projectId, {
        name: data.title,
        description: data.description,
        icon: data.icon,
        color: data.color,
      }),
    onSuccess: (updated) => {
      onUpdated?.(updated);
      onClose();
    },
    onError: (err) => {
      setError("Errore durante l'aggiornamento del progetto");
      console.error(err);
    },
  });

  const handleUpdateProject = (data: ProjectDetailsData) => {
    setError("");
    updateProjectMutation.mutate(data);
  };

  return (
    <ModalOverlay isOpen={true} onClose={onClose}>
      <div className="relative">
        {error ? (
          <div className="absolute top-0 left-0 right-0 -translate-y-full mb-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm text-center">
            {error}
          </div>
        ) : null}

        <ProjectDetailsStep
          mode="edit"
          isSubmitting={updateProjectMutation.isPending}
          initialData={{
            title: project.name,
            description: project.description,
            icon: project.icon,
            color: project.color,
          }}
          onNext={handleUpdateProject}
          onExit={onClose}
        />
      </div>
    </ModalOverlay>
  );
}
