import { useEffect, useRef, useState, type ReactNode } from "react";
import { RiArrowGoBackLine } from "react-icons/ri";
import { HexColorPicker } from "react-colorful";
import { IoColorPalette } from "react-icons/io5";

import { PREDEFINED_COLORS } from "@features/project/model/constants";
import { PREDEFINED_ICONS } from "@features/project/ui/projectIcons";
import { FooterActions } from "@shared/ui/FooterActions";
import { FormField } from "@shared/ui/FormField";
import { ScrollComponent } from "@shared/ui/ScrollComponent";
import { DescriptionFieldWithLength } from "@shared/ui/DescriptionFieldWithLength";
import { TitleFieldWithLength } from "@shared/ui/TitleFieldWithLength";
import { ProjectFormLayout } from "@widgets/layout/ProjectFormLayout";

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
    headerAction?: ReactNode;
}

export function ProjectDetailsStep({ mode, isSubmitting, initialData, onNext, onExit, headerAction }: ProjectDetailsStepProps) {

    const [title, setTitle] = useState(initialData?.title || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || "folder");
    const [selectedColor, setSelectedColor] = useState(initialData?.color || PREDEFINED_COLORS[0]);
    const [isOpen, toggle] = useState(false);
    const popover = useRef(null);

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
            headerAction={headerAction}

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
                <TitleFieldWithLength
                    title={title}
                    onChangeTitle={setTitle}
                    maxLength={20}
                    placeholder="Insert your Project Title in minimum 3 characters..."
                    label="Project Title"
                />
            </div>

            <div className="flex flex-col gap-2">
                <DescriptionFieldWithLength
                    description={description}
                    onChangeDescription={setDescription}
                    maxLength={256}
                    placeholder="Describe the project goals in minimum 5 characters..."
                    label="Description"
                />
            </div>

            <div className="flex flex-col md:flex-row gap-6">

                <div className="flex-1">
                    <FormField label="Project Icon">
                        <ScrollComponent maxHeight="max-h-32">
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
                        </ScrollComponent>
                    </FormField>
                </div>

                <div className="flex flex-col gap-2">
                    <FormField label="Theme Color">
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
                    </FormField>
                </div>
            </div>

        </ProjectFormLayout>
    );
}

