import React, { useState } from "react";
import { ModalOverlay } from "../../components/layout/ModalOverlay";
import { GlassCard } from "../../components/ui/GlassCard";
import { FormField } from "../../components/ui/FormField";
import { TitleFieldWithLenght } from "../../components/ui/TitleFieldWithLenght";
import { DescriptionFieldWithLenght } from "../../components/ui/DescriptionFieldWithLenght";
import { Select } from "../../components/ui/Select";
import { FileAttachment } from "../../components/ui/FileAttachment";
import { PrioritySelector } from "../../components/ui/PrioritySelector";
import { TagInput } from "../../components/ui/TagInput";
import { CATEGORIES } from "../../utils/issueConstants";
import { FiX } from "react-icons/fi";
import { Button } from "../../components/ui/Button";

interface IssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: "create" | "edit";
    // We can add initialData here for edit mode in the future
}

export function IssueModal({ isOpen, onClose, mode }: IssueModalProps) {
    // --- States ---
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState(CATEGORIES[0].value);
    const [priority, setPriority] = useState("medium");
    const [tags, setTags] = useState<string[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Validation (simple example)
    const isFormValid = title.trim().length >= 3 && description.trim().length >= 5;

    const handleSubmit = async () => {
        if (!isFormValid) return;
        setIsSubmitting(true);
        try {
            // TODO: Here we'll call the API to create/edit the issue
            // e.g. await createProjectIssueApi(projectId, { title, description, category, priority, tags })
            console.log("Submitting:", { title, description, category, priority, tags, files });

            // Simulate API delay
            await new Promise(res => setTimeout(res, 800));
            onClose(); // Close modal on success
        } catch (error) {
            console.error("Failed to submit issue", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalOverlay isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
            <GlassCard className="max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                        {mode === "create" ? "Create New Issue" : "Edit Issue"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Body (Scrollable if content is too long) */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">

                    {/* Title & Category Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        <div className="md:col-span-2">
                            <TitleFieldWithLenght
                                label="Title"
                                title={title}
                                onChangeTitle={setTitle}
                                placeholder="What's the issue?"
                            />
                        </div>
                        <div>
                            {/* Override the Select's rounded-full to rounded-lg to match the design */}
                            <FormField label="Category">
                                <Select
                                    options={CATEGORIES}
                                    value={category}
                                    onChange={setCategory}
                                    className="[&>select]:rounded-lg"
                                />
                            </FormField>
                        </div>
                    </div>

                    {/* Description */}
                    <DescriptionFieldWithLenght
                        label="Description"
                        description={description}
                        onChangeDescription={setDescription}
                        placeholder="Provide more details about the issue..."
                        maxLength={1000}
                    />

                    {/* File Attachment */}
                    <FileAttachment onFilesChange={setFiles} />

                    {/* Priority & Tags Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <PrioritySelector value={priority} onChange={setPriority} />
                        <TagInput tags={tags} onChange={setTags} />
                    </div>

                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-white/5 bg-[#0D0D12]/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!isFormValid || isSubmitting}
                        isLoading={isSubmitting}
                        fullWidth={false}
                    >
                        {mode === "create" ? "Create Issue" : "Save Changes"}
                    </Button>
                </div>

            </GlassCard>
        </ModalOverlay>
    );
}
