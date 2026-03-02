import { useState } from "react";
// Importiamo il componente Step 1 che hai creato prima
import { ProjectDetailsStep, type ProjectDetailsData } from "./ProjectDetailsStep";
import { createProjectApi } from "../../services/api";

interface CreateProjectFlowProps {
    onClose: () => void;
}

export function CreateProjectFlow({ onClose }: CreateProjectFlowProps) {
    // 1. STATO: Traccia in quale step ci troviamo (1 = Dettagli, 2 = Team)
    const [currentStep, setCurrentStep] = useState<1 | 2>(1);

    // 2. STATO: I dati temporanei del progetto raccolti dallo Step 1
    const [projectData, setProjectData] = useState<ProjectDetailsData | null>(null);

    // 3. STATO: Traccia caricamento e l'errore dell'API
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Quando clicchiamo "Next" nello Step 1
    const handleStep1Next = (data: ProjectDetailsData) => {
        setProjectData(data); // Salviamo il titolo, colore, ecc.
        setCurrentStep(2);    // E andiamo allo Step 2!
    };

    // Quando clicchiamo "Back" nello Step 2 (per tornare indietro se abbiamo sbagliato titolo)
    const handleStep2Back = () => {
        setCurrentStep(1);
    };

    const handleCreateProject = async (selectedUserIds: number[]) => {
        // 1. Mettiamo il modale in stato di caricamento
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

            // 3. Se va tutto bene, chiudiamo il modale e magari ricarichiamo la lista progetti!
            onClose();

        } catch (error) {
            // Se fallisce mostriamo l'errore
            setError("Errore durante la creazione del progetto");
        } finally {
            setIsSubmitting(false);
        }
    };


    // UI: Lo sfondo scuro a tutto schermo (Overlay Modale)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D12]/90 backdrop-blur-sm p-4">

            {/* Animazione/Transizione molto base gestita coi componenti React */}
            <div className="w-full max-w-4xl relative animate-in fade-in zoom-in duration-200">

                {/* RENDERIZZAZIONE CONDIZIONALE DEGLI STEP */}

                {currentStep === 1 && (
                    <ProjectDetailsStep
                        mode="create"
                        initialData={projectData || undefined} // Se torniamo indietro dal 2, ricarica i dati salvati
                        onNext={handleStep1Next}
                        onExit={onClose}
                    />
                )}

                {currentStep === 2 && (
                    // QUI METTEREMO IL ProjectTeamStep! (Prossimo passaggio)
                    <div className="bg-[#121620] p-8 rounded-2xl text-center border border-white/10">
                        <h2 className="text-xl font-bold text-white mb-4">Step 2: Team Selection</h2>
                        <p className="text-neutral-400 mb-6">
                            You're creating a project named: <span className="text-white font-semibold">"{projectData?.title}"</span>
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={handleStep2Back}
                                className="px-6 py-2 rounded-lg bg-[#1E2332] text-white hover:bg-[#252B3D]"
                            >
                                Go Back to Step 1
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 rounded-lg bg-[#5671F6] text-white hover:bg-[#455CE6]"
                            >
                                (Simula) Create Project
                            </button>
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
}
