import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FiTrash2 } from "react-icons/fi";

import { ProjectDetailsStep, type ProjectDetailsData } from "./ProjectDetailsStep";
import { DeleteProjectFlow } from "./DeleteProjectFlow";
import { updateProjectApi } from "@features/project/api";
import type { Project } from "@shared/api/types/projects";
import { useToast } from "@shared/providers";
import { InlineFeedbackMessage } from "@shared/ui";
import { ModalOverlay } from "@widgets/layout/ModalOverlay";

interface EditProjectFlowProps {
  project: Project;
  onClose: () => void;
  onUpdated?: (updatedProject: Project) => void;
}

export function EditProjectFlow({ project, onClose, onUpdated }: EditProjectFlowProps) {
  const [error, setError] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { pushSuccessToast } = useToast();

  const updateProjectMutation = useMutation({
    mutationFn: (data: ProjectDetailsData) =>
      updateProjectApi(project.projectId, {
        name: data.title,
        description: data.description,
        icon: data.icon,
        color: data.color,
      }),
    onSuccess: (updated) => {
      pushSuccessToast("Project updated successfully.");
      onUpdated?.(updated);
      onClose();
    },
    onError: (err) => {
      setError("Error updating project.");
      console.error(err);
    },
  });

  const handleUpdateProject = (data: ProjectDetailsData) => {
    setError("");
    updateProjectMutation.mutate(data);
  };

  return (
    <>
      <ModalOverlay isOpen={true} onClose={onClose}>
        <div className="relative">
          {error ? (
            <div className="absolute top-0 left-0 right-0 -translate-y-full px-4">
              <InlineFeedbackMessage message={error} className="text-center" />
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
            headerAction={
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                <FiTrash2 size={16} />
                Delete Project
              </button>
            }
          />
        </div>
      </ModalOverlay>

      <DeleteProjectFlow
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        projectId={project.projectId}
        projectName={project.name}
      />
    </>
  );
}
