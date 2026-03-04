import { useState } from "react";
import { ModalOverlay } from "../../components/layout/ModalOverlay";
import { GlassCard } from "../../components/ui/GlassCard";
import { FormField } from "../../components/ui/FormField";
import { TitleFieldWithLenght } from "../../components/ui/TitleFieldWithLenght";
import { DescriptionFieldWithLenght } from "../../components/ui/DescriptionFieldWithLenght";
import { Select } from "../../components/ui/Select";
import { FileAttachment } from "../../components/ui/FileAttachment";
import { PrioritySelector } from "../../components/ui/PrioritySelector";
import { TagInput } from "../../components/ui/TagInput";
import { CATEGORIES, STATUSES } from "../../utils/issueConstants";
import { FiX } from "react-icons/fi";
import { Button } from "../../components/ui/Button";
import { useEffect } from "react";
import { createProjectIssueApi, updateIssueApi, type Issue } from "../../services/api";

interface IssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: "create" | "edit";
    projectId?: string | number;
    issue?: Issue | null;
    initialData?: Issue | null;
    onSuccess?: () => void;
}

export function IssueModal({ isOpen, onClose, mode, projectId, issue, initialData, onSuccess }: IssueModalProps) {
    // --- States ---
    const [title, setTitle] = useState(initialData?.title || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [category, setCategory] = useState(initialData?.type?.toLowerCase() || CATEGORIES[0].value);
    const [priority, setPriority] = useState(initialData?.priority?.toLowerCase() || "medium");
    const [status, setStatus] = useState(initialData?.status?.toLowerCase() || STATUSES[0].value); // DEVO INSERIRE QUESTA LOGICA <----------------
    const [tags, setTags] = useState<string[]>(initialData?.tags?.map(tag => tag.name) || []);
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData && mode === "edit") {
            setTitle(initialData.title);
            setDescription(initialData.description);
            setCategory(initialData.type?.toLowerCase() || CATEGORIES[0].value);
            setPriority(initialData.priority?.toLowerCase() || "medium");
            setStatus(initialData.status?.toLowerCase() || STATUSES[0].value);
            setTags(initialData.tags?.map(t => t.name) || []);
        }
    }, [initialData, mode]);

    // Validation (simple example)
    const isFormValid = title.trim().length >= 3 && description.trim().length >= 5;

    const handleSubmit = async () => {
        if (!isFormValid) return;
        setIsSubmitting(true);
        try {
            if (mode === "create" && projectId) {
                await createProjectIssueApi(projectId, {
                    title,
                    description,
                    type: category, // L'API lo chiama 'type'
                    priority,
                    tagNames: tags,
                    // Nota: se i file richiedono chiamate separate, andranno gestite qui
                });
            } else if (mode === "edit" && issue?.issueId) {
                await updateIssueApi(issue.issueId, {
                    title,
                    description,
                    type: category,
                    priority,
                    status,
                    tagNames: tags,
                });
            }

            if (onSuccess) onSuccess();
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
                                maxLength={30}
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
