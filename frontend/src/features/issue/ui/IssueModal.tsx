import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FiX } from "react-icons/fi";

import { buildIssueEditActivityMessage } from "@features/issue/lib/buildIssueEditActivityMessage";

import { createIssueUpdateApi, updateIssueDetailsApi } from "@features/issue/api";
import { createProjectIssueApi } from "@features/project/api";
import type { Issue } from "@shared/api/types/issues";
import { CATEGORIES, STATUSES } from "@features/issue/model/constants";
import { useSubmitValidation } from "@shared/hooks";
import { useToast } from "@shared/providers";
import { Button } from "@shared/ui/Button";
import { DescriptionFieldWithLength } from "@shared/ui/DescriptionFieldWithLength";
import { FormField } from "@shared/ui/FormField";
import { GlassCard } from "@shared/ui/GlassCard";
import { InlineFeedbackMessage } from "@shared/ui/InlineFeedbackMessage";
import { Select } from "@shared/ui/Select";
import { TagInput } from "@shared/ui/TagInput";
import { TitleFieldWithLength } from "@shared/ui/TitleFieldWithLength";
import { ModalOverlay } from "@widgets/layout/ModalOverlay";

import { FileAttachment } from "./FileAttachment";
import { PrioritySelector } from "./PrioritySelector";

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  projectId?: string | number;
  issue?: Issue | null;
  initialData?: Issue | null;
  onSuccess?: () => void;
}

type SubmitResult = {
  warning: string | null;
};

type IssueFormState = {
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  tags: string[];
};

function toNonBlockingWarning(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: unknown }).response !== null
  ) {
    const response = (error as { response: { status?: number; data?: unknown } }).response;
    if (response.status === 403) {
      return "Issue created, but first comment/attachments not saved (insufficient permissions).";
    }

    const data = response.data;
    if (typeof data === "object" && data !== null) {
      if ("detail" in data && typeof (data as { detail?: unknown }).detail === "string") {
        return `Issue created, but first comment/attachments not saved: ${(data as { detail: string }).detail}`;
      }
      if ("file" in data && typeof (data as { file?: unknown }).file === "string") {
        return `Issue created, but first comment/attachments not saved: ${(data as { file: string }).file}`;
      }
    }
  }

  return "Issue created, but first comment/attachments not saved.";
}

function getInitialFormState(mode: "create" | "edit", initialData?: Issue | null): IssueFormState {
  if (mode === "edit" && initialData) {
    return {
      title: initialData.title,
      description: initialData.description,
      category: initialData.type || CATEGORIES[0].value,
      priority: initialData.priority || "MEDIUM",
      status: initialData.status || STATUSES[0].value,
      tags: initialData.tags?.map((tag) => tag.name) || [],
    };
  }

  return {
    title: "",
    description: "",
    category: CATEGORIES[0].value,
    priority: "MEDIUM",
    status: STATUSES[0].value,
    tags: [],
  };
}

export function IssueModal({ isOpen, onClose, mode, projectId, issue, initialData, onSuccess }: IssueModalProps) {
  if (!isOpen) {
    return null;
  }

  const modalKey =
    mode === "edit"
      ? `edit-${initialData?.issueId ?? issue?.issueId ?? "unknown"}`
      : `create-${projectId ?? "unknown"}`;

  return (
    <IssueModalContent
      key={modalKey}
      onClose={onClose}
      mode={mode}
      projectId={projectId}
      issue={issue}
      initialData={initialData}
      onSuccess={onSuccess}
    />
  );
}

function IssueModalContent({
  onClose,
  mode,
  projectId,
  issue,
  initialData,
  onSuccess,
}: Omit<IssueModalProps, "isOpen">) {
  const initialFormState = useMemo(() => getInitialFormState(mode, initialData), [mode, initialData]);
  const [title, setTitle] = useState(initialFormState.title);
  const [description, setDescription] = useState(initialFormState.description);
  const [category, setCategory] = useState(initialFormState.category);
  const [priority, setPriority] = useState(initialFormState.priority);
  const [status, setStatus] = useState(initialFormState.status);
  const [tags, setTags] = useState<string[]>(initialFormState.tags);
  const [files, setFiles] = useState<File[]>([]);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [createdWithWarning, setCreatedWithWarning] = useState(false);
  const validation = useSubmitValidation<"title" | "description">();
  const { pushSuccessToast } = useToast();

  const hasChanges = useMemo(() => {
    if (mode === "create") return true;
    if (!initialData) return false;

    const titleChanged = title !== initialData.title;
    const descChanged = description !== initialData.description;
    const categoryChanged = category !== (initialData.type || "");
    const priorityChanged = priority !== (initialData.priority || "");
    const statusChanged = status !== (initialData.status || "");
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(initialData.tags?.map((t) => t.name) || []);
    const filesChanged = files.length > 0;

    return titleChanged || descChanged || categoryChanged || priorityChanged || statusChanged || tagsChanged || filesChanged;
  }, [mode, initialData, title, description, category, priority, status, tags, files]);

  const submitMutation = useMutation<SubmitResult>({
    mutationFn: async () => {
      let resultIssue: Issue | null = null;
      let warning: string | null = null;

      if (mode === "create" && projectId) {
        resultIssue = await createProjectIssueApi(projectId, {
          title,
          description,
          type: category,
          priority,
          tagNames: tags,
        });

        try {
          const firstMessage = description.trim();
          if (files.length > 0) {
            await createIssueUpdateApi(resultIssue.issueId, {
              message: firstMessage,
              files: files,
            });
          } else {
            await createIssueUpdateApi(resultIssue.issueId, { message: firstMessage });
          }
        } catch (error) {
          warning = toNonBlockingWarning(error);
          console.warn("Initial issue comment/attachments failed", error);
        }
      } else if (mode === "edit" && issue?.issueId) {
        const editMessage = initialData
          ? buildIssueEditActivityMessage(initialData, {
            title,
            description,
            type: category,
            status,
            priority,
            tags,
          })
          : "Issue updated";

        resultIssue = await updateIssueDetailsApi(issue.issueId, {
          title,
          description,
          type: category,
          priority,
          status,
          tagNames: tags,
          message: editMessage,
        });
      }

      return { warning };
    },
    onSuccess: (result) => {
      if (result.warning) {
        setSubmitWarning(result.warning);
        setCreatedWithWarning(true);
        return;
      }
      pushSuccessToast(
        mode === "create" ? "Issue created successfully." : "Issue updated successfully.",
      );
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Failed to submit issue", error);
    },
  });

  const handleSubmit = () => {
    if (submitMutation.isPending || createdWithWarning || (mode === "edit" && !hasChanges)) return;

    const isValid = validation.validate({
      title: title.trim().length >= 3,
      description: mode === "edit" || description.trim().length >= 5,
    });

    if (!isValid) {
      setValidationMessage("Please check the highlighted fields.");
      return;
    }

    setValidationMessage("");
    submitMutation.mutate();
  };

  return (
    <ModalOverlay isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
      <GlassCard className="max-h-[85vh]">
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

        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            <div className="md:col-span-2">
              <TitleFieldWithLength
                label="Title"
                title={title}
                onChangeTitle={(value) => {
                  setTitle(value);
                  validation.updateFieldValidity("title", value.trim().length >= 3);
                  if (validationMessage) setValidationMessage("");
                }}
                placeholder="What's the issue?"
                maxLength={30}
                hasError={validation.hasFieldError("title")}
              />
            </div>
            <div>
              <FormField label="Status">
                <Select
                  options={STATUSES}
                  value={status}
                  onChange={setStatus}
                  className="[&>select]:rounded-lg"
                />
              </FormField>
            </div>
            <div>
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

          {mode === "create" && (
            <DescriptionFieldWithLength
              label="Description"
              description={description}
              onChangeDescription={(value) => {
                setDescription(value);
                validation.updateFieldValidity("description", value.trim().length >= 5);
                if (validationMessage) setValidationMessage("");
              }}
              placeholder="Provide more details about the issue..."
              maxLength={1000}
              textareaClassName="!min-h-[80px]"
              hasError={validation.hasFieldError("description")}
            />
          )}
          {mode === "create" && <FileAttachment onFilesChange={setFiles} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <PrioritySelector value={priority} onChange={setPriority} />
            <TagInput tags={tags} onChange={setTags} />
          </div>
        </div>

        <div className="flex flex-col gap-3 p-6 border-t border-white/5 bg-[#0D0D12]/30">
          {submitWarning ? (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2">
              {submitWarning}
            </div>
          ) : null}
          <InlineFeedbackMessage message={validationMessage} />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              {createdWithWarning ? "Close" : "Cancel"}
            </button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitMutation.isPending || (mode === "edit" && !hasChanges) || createdWithWarning}
              isLoading={submitMutation.isPending}
              fullWidth={false}
            >
              {createdWithWarning
                ? "Issue Created"
                : mode === "create"
                  ? "Create Issue"
                  : "Save Changes"}
            </Button>
          </div>
        </div>
      </GlassCard>
    </ModalOverlay>
  );
}
