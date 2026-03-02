import { useState } from "react";
import { ProjectDetailsStep, type ProjectDetailsData } from "./ProjectDetailsStep";
import { updateProjectApi, type Project } from "../../services/api";

interface EditProjectFlowProps {
    project: Project;
    onClose: () => void;
    onUpdated?: (updatedProject: Project) => void;
}

export function EditProjectFlow({ project, onClose, onUpdated }: EditProjectFlowProps) {
    // 1. STATO: Traccia caricamento e l'errore dell'API
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Quando clicchiamo "Confirm" nello Step 1 (Edit mode)
    const handleUpdateProject = async (data: ProjectDetailsData) => {
        setIsSubmitting(true);
        setError("");

        try {
            const updated = await updateProjectApi(project.projectId, {
                name: data.title,
                description: data.description,
                icon: data.icon,
                color: data.color
            });

            if (onUpdated) {
                onUpdated(updated);
            }
            onClose();

        } catch (err) {
            setError("Errore durante l'aggiornamento del progetto");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D12]/90 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl relative animate-in fade-in zoom-in duration-200">

                {error && (
                    <div className="absolute top-0 left-0 right-0 -translate-y-full mb-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <ProjectDetailsStep
                    mode="edit"
                    initialData={{
                        title: project.name,
                        description: project.description,
                        icon: project.icon,
                        color: project.color
                    }}
                    onNext={handleUpdateProject}
                    onExit={onClose}
                />
            </div>
        </div>
    );
}
