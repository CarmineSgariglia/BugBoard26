import { useState } from "react";
import { ProjectFormLayout } from "../../components/layout/ProjectFormLayout";
import { FooterActions } from "../../components/ui/FooterActions";
import { RiArrowGoBackLine } from "react-icons/ri";

// Icone React a caso per la griglia rapida
import { FiFolder, FiStar, FiSun, FiActivity, FiAnchor, FiAperture, FiBriefcase, FiMoreHorizontal } from "react-icons/fi";

// I 5 colori base della tavolozza
const PREDEFINED_COLORS = ["#5671F6", "#F5B025", "#EF476F", "#A0B2C6", "#06D6A0", "#FF0000", "#00FF00"];

// Le 7 icone base 
const PREDEFINED_ICONS = [
    { id: "folder", icon: FiFolder },
    { id: "star", icon: FiStar },
    { id: "sun", icon: FiSun },
    { id: "activity", icon: FiActivity },
    { id: "anchor", icon: FiAnchor },
    { id: "aperture", icon: FiAperture },
    { id: "briefcase", icon: FiBriefcase },
];

export interface ProjectDetailsData {
    title: string;
    description: string;
    icon: string;
    color: string;
}

interface ProjectDetailsStepProps {
    mode: "create" | "edit";
    initialData?: ProjectDetailsData;
    onNext: (data: ProjectDetailsData) => void;
    onExit: () => void;
}

export function ProjectDetailsStep({ mode, initialData, onNext, onExit }: ProjectDetailsStepProps) {

    // 1. STATI
    const [title, setTitle] = useState(initialData?.title || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || "folder");
    const [selectedColor, setSelectedColor] = useState(initialData?.color || PREDEFINED_COLORS[0]);

    // 2. LOGICA E VALIDAZIONI
    const isSaveEnabled = title.trim().length >= 3 && description.trim().length >= 5;

    const handleNextClick = () => {
        if (!isSaveEnabled) return;

        onNext({
            title: title.trim(),
            description: description.trim(),
            icon: selectedIcon,
            color: selectedColor
        });
    };

    // 3. UI
    return (
        <ProjectFormLayout
            title={mode === "create" ? "Project Details" : "Edit Project"}
            subtitle={
                mode === "create"
                    ? "Start by defining the basics of your new project."
                    : "Your Projects informations"
            }
            stepInfo={mode === "create" ? "STEP 1 OF 2" : undefined}

            footer={
                <FooterActions
                    isSaveEnabled={isSaveEnabled}
                    onSave={handleNextClick}
                    isSaving={false}
                    links={[{ label: "Exit", icon: <RiArrowGoBackLine size={16} />, onClick: onExit }]}
                    // Usa saveLabel (che già hai in FooterActions)
                    saveLabel={mode === "create" ? "Next" : "Confirm"}
                />
            }
        >
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">Project Title</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={20}
                    placeholder="e.g. Q4 Marketing Campaign"
                    className="w-full bg-[#0D0D12]/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#5671F6] focus:ring-1 focus:ring-[#5671F6] transition-all"
                />
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">Description</label>
                    <span className="text-[10px] text-neutral-500 font-medium">
                        {description.length} / 256
                    </span>
                </div>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={256}
                    placeholder="Describe the project goals and objectives..."
                    rows={4}
                    className="w-full bg-[#0D0D12]/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#5671F6] focus:ring-1 focus:ring-[#5671F6] transition-all resize-none"
                />
            </div>

            <div className="flex flex-col md:flex-row gap-6">

                <div className="flex-1 flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">Project Icon</label>
                    <div className="border border-white/5 bg-[#121620]/50 rounded-xl p-4">
                        <div className="grid grid-cols-4 gap-3">
                            {PREDEFINED_ICONS.map((item) => {
                                const IconComp = item.icon;
                                const isSelected = selectedIcon === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedIcon(item.id)}
                                        className={`flex items-center justify-center p-3 rounded-lg transition-all ${isSelected
                                            ? "bg-[#5671F6] text-white shadow-lg shadow-[#5671F6]/20"
                                            : "bg-[#1E2332] text-neutral-400 hover:text-white hover:bg-[#252B3D]"
                                            }`}
                                    >
                                        <IconComp size={18} />
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => alert("Mostra modale con 20 icone!")}
                                className="flex items-center justify-center p-3 rounded-lg bg-[#1E2332] text-neutral-400 hover:text-white hover:bg-[#252B3D] transition-all"
                            >
                                <FiMoreHorizontal size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">Theme Color</label>
                    <div className="grid grid-cols-4 gap-y-8 gap-x-8 pt-4 items-center justify-items-start">

                        {PREDEFINED_COLORS.map(colorHex => {
                            const isSelected = selectedColor === colorHex;

                            return (
                                <button
                                    key={colorHex}
                                    type="button"
                                    onClick={() => setSelectedColor(colorHex)}
                                    className={`w-7 h-7 rounded-full shadow-md transition-all ${isSelected
                                        ? "ring-2 ring-offset-2 ring-offset-[#0D0D12] ring-[#5671F6] scale-110"
                                        : "border border-white/10 hover:scale-110"
                                        }`}
                                    style={{ backgroundColor: colorHex }}
                                />
                            );
                        })}

                        <div className="relative cursor-pointer hover:scale-110 transition-transform">
                            <input
                                type="color"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                className="w-7 h-7 bg-transparent border-0 opacity-0 absolute top-0 left-0 cursor-pointer"
                            />
                            <div className="w-7 h-7 rounded-full border border-white/20 bg-gradient-to-tr from-[#5671F6] via-[#EF476F] to-[#06D6A0] pointer-events-none flex items-center justify-center" />
                        </div>
                    </div>
                </div>

            </div>

        </ProjectFormLayout>
    );
}
