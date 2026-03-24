import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RiCloseLine } from "react-icons/ri";
import { FiTrash2 } from "react-icons/fi";

import { ModalOverlay } from "@widgets/layout/ModalOverlay";
import { FooterActions } from "@shared/ui/FooterActions";
import { deleteProjectApi } from "@features/project/api";
import { generateConfirmationCode } from "@features/project/lib/confirmationCode";
import type { Project } from "@shared/api/types/projects";

interface DeleteProjectFlowProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
}

export function DeleteProjectFlow({ isOpen, onClose, projectId, projectName }: DeleteProjectFlowProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <DeleteProjectDialog
      onClose={onClose}
      projectId={projectId}
      projectName={projectName}
    />
  );
}

function DeleteProjectDialog({
  onClose,
  projectId,
  projectName,
}: Omit<DeleteProjectFlowProps, "isOpen">) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmationCode] = useState(() => generateConfirmationCode(10));
  const [userInput, setUserInput] = useState("");

  const deleteMutation = useMutation({
    mutationFn: () => deleteProjectApi(projectId),
    onSuccess: () => {
      queryClient.setQueryData<Project[]>(["projects"], (currentProjects = []) =>
        currentProjects.filter((project) => project.projectId !== projectId)
      );
      onClose();
      navigate("/projects", { replace: true });
    },
    onError: (error) => {
      console.error("Failed to delete project:", error);
      alert("Error deleting project.");
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const isMatch = userInput === confirmationCode;

  return (
    <ModalOverlay isOpen={true} onClose={onClose} maxWidth="max-w-xl">
      <div className="bg-[#121620] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
              <FiTrash2 size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Delete Project</h2>
              <p className="text-sm text-neutral-400">This action is irreversible.</p>
            </div>
          </div>
        </div>

        <div className="p-8 flex flex-col gap-6">
          <p className="text-sm text-neutral-300 leading-relaxed">
            You are about to delete the project <span className="text-white font-bold">"{projectName}"</span>.
            All issues, comments, and associated data will be permanently removed.
          </p>

          <div className="bg-[#0D0D12]/50 border border-white/5 rounded-xl p-6 flex flex-col items-center gap-4">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest text-center">
              Confirmation code (10 digits)
            </p>
            <div className="text-2xl font-mono font-bold text-white tracking-[0.5em] select-none">
              {confirmationCode}
            </div>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value.replace(/\D/g, ""))}
              placeholder="Type the code above..."
              className="w-full h-12 bg-[#1A1D24] border border-white/10 rounded-lg px-4 text-center text-lg font-mono focus:border-red-500/50 focus:outline-none transition-all text-white"
              maxLength={10}
            />
          </div>
        </div>

        <div className="bg-[#0D0D12]/30 border-t border-white/5">
          <FooterActions
            isSaveEnabled={isMatch}
            onSave={handleDelete}
            isSaving={deleteMutation.isPending}
            saveLabel="DELETE PROJECT"
            links={[
              {
                label: "Cancel",
                icon: <RiCloseLine size={18} />,
                onClick: onClose,
              },
            ]}
          />
        </div>
      </div>
    </ModalOverlay>
  );
}
