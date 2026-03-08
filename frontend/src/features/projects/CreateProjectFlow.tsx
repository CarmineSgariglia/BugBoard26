import { useState } from "react";
import { ProjectDetailsStep, type ProjectDetailsData } from "./ProjectDetailsStep";
import { ProjectTeamStep } from "./ProjectTeamStep";
import { createProjectApi } from "../../services/api";
import { ModalOverlay } from "../../components/layout/ModalOverlay";

interface CreateProjectFlowProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function CreateProjectFlow({ isOpen, onClose, onSuccess }: CreateProjectFlowProps) {
    // 1. STATO: Traccia in quale step ci troviamo (1 = Dettagli, 2 = Team)
    const [currentStep, setCurrentStep] = useState<1 | 2>(1);

    // 2. STATO: I dati temporanei del progetto raccolti dallo Step 1
    const [projectData, setProjectData] = useState<ProjectDetailsData | null>(null);

    // 3. STATO: Traccia caricamento e l'errore dell'API
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // 4. STATO: Membri del team selezionati
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    // Quando clicchiamo "Next" nello Step 1
    const handleStep1Next = (data: ProjectDetailsData) => {
        setProjectData(data); // Salviamo il titolo, colore, ecc.
        setCurrentStep(2);    // E andiamo allo Step 2!
    };

    // Quando clicchiamo "Back" nello Step 2 (per tornare indietro se abbiamo sbagliato titolo)
    const handleStep2Back = () => {
        setCurrentStep(1);
    };

    const toggleUser = (userId: number) => {
        setSelectedUserIds((prev: number[]) =>
            prev.includes(userId)
                ? prev.filter((id: number) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleCreateProject = async (selectedUserIds: number[]) => {
        // 1. Mettiamo il modale in stato di caricamento
        if (!projectData) {
            setError("Error: Project data is missing.");
            console.log("Error: Project data is missing.");
            return;
        }

        setIsSubmitting(true);

        try {
            // 2. Chiamiamo l'API fondendo i dati dello Step 1 (titolo, colore) 
            // con i dati dello Step 2 (gli ID degli utenti scelti)
            await createProjectApi({
                name: projectData!.title,
                description: projectData!.description,
                icon: projectData!.icon,
                color: projectData!.color,
                team: selectedUserIds // Manda l'array di ID al backend!
            });

            // 3. Se va tutto bene, chiamiamo il callback di successo e chiudiamo
            if (onSuccess) onSuccess();
            onClose();

        } catch {
            // Se fallisce mostriamo l'errore
            setError("Errore durante la creazione del progetto");
        } finally {
            setIsSubmitting(false);
        }
    };


    // UI: Lo sfondo scuro a tutto schermo (Overlay Modale)
    return (
        <ModalOverlay isOpen={isOpen} onClose={onClose}>
            {/* Animazione/Transizione molto base gestita coi componenti React */}
            <div className="relative">
                {/* RENDERIZZAZIONE CONDIZIONALE DEGLI STEP */}

                {currentStep === 1 && (
                    <ProjectDetailsStep
                        mode="create"
                        initialData={projectData || undefined} // Se torniamo indietro dal 2, ricarica i dati salvati
                        onNext={handleStep1Next}
                        onExit={onClose}
                    />
                )}

                {error && (
                    <div className="mx-8 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center">
                        {error}
                    </div>
                )}

                {currentStep === 2 && (
                    <ProjectTeamStep
                        mode="create"
                        selectedUserIds={selectedUserIds}
                        onToggleUser={toggleUser}
                        onBack={handleStep2Back}
                        onConfirm={() => handleCreateProject(selectedUserIds)}
                        isSubmitting={isSubmitting}
                    />
                )}
            </div>
        </ModalOverlay>
    );
}
