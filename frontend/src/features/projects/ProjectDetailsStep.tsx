import { useEffect, useRef, useState } from "react";
import { ProjectFormLayout } from "../../components/layout/ProjectFormLayout";
import { FooterActions } from "../../components/ui/FooterActions";
import { RiArrowGoBackLine } from "react-icons/ri";
import { PREDEFINED_ICONS, PREDEFINED_COLORS } from "../../utils/projectIcons";
import { HexColorPicker } from "react-colorful";
import { IoColorPalette } from "react-icons/io5";

export interface ProjectDetailsData {
    title: string;
    description: string;
    icon: string;
    color: string;
}


interface ProjectDetailsStepProps {
    mode: "create" | "edit";
    isSubmitting?: boolean;
    initialData?: ProjectDetailsData;
    onNext: (data: ProjectDetailsData) => void;
    onExit: () => void;
}

export function ProjectDetailsStep({ mode, isSubmitting, initialData, onNext, onExit }: ProjectDetailsStepProps) {

    // 1. STATI
    const [title, setTitle] = useState(initialData?.title || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || "folder");
    const [selectedColor, setSelectedColor] = useState(initialData?.color || PREDEFINED_COLORS[0]);
    const [isOpen, toggle] = useState(false);
    const popover = useRef(null);

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

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (popover.current && !(popover.current as HTMLElement).contains(e.target as Node)) {
                toggle(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

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
                    isSaveEnabled={isSaveEnabled && !isSubmitting}
                    onSave={handleNextClick}
                    isSaving={isSubmitting}
                    links={[{ label: "Exit", icon: <RiArrowGoBackLine size={16} />, onClick: onExit }]}
                    saveLabel={mode === "create" ? "Next" : "Confirm"}
                />
            }
        >
            <div className="flex flex-col gap-2" >
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
                    <div className="border border-white/5 bg-[#121620]/50 rounded-xl p-4 max-h-32 overflow-y-auto custom-scrollbar">
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
                        <div className="relative">
                            <div onClick={() => toggle(!isOpen)} className="cursor-pointer hover:scale-110 transition-transform">

                                <div style={{ backgroundColor: selectedColor }} className="w-7 h-7 rounded-full border border-white/20  pointer-events-none flex items-center justify-center" >
                                    <IoColorPalette size={18} style={{ filter: "drop-shadow(0px 0px 5px rgba(0, 0, 0, 0.5))" }} color={"white"} />
                                </div>
                            </div>
                            {isOpen && (

                                <div className="absolute z-[100] bottom-full mb-1 right-0" ref={popover}>
                                    <HexColorPicker color={selectedColor} onChange={setSelectedColor} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </ProjectFormLayout>
    );
}
