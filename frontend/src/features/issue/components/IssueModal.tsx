import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FiX } from "react-icons/fi";

import { buildIssueEditActivityMessage } from "@features/issue/lib/buildIssueEditActivityMessage";
import { uploadAttachmentApi } from "@shared/api/modules/attachments";
import { createIssueUpdateApi, updateIssueDetailsApi } from "@shared/api/modules/issues";
import { createProjectIssueApi } from "@shared/api/modules/projects";
import type { Issue } from "@shared/api/types/issues";
import { CATEGORIES, STATUSES } from "@shared/constants/issueConstants";
import { Button } from "@shared/ui/Button";
import { DescriptionFieldWithLenght } from "@shared/ui/DescriptionFieldWithLenght";
import { FileAttachment } from "@shared/ui/FileAttachment";
import { FormField } from "@shared/ui/FormField";
import { GlassCard } from "@shared/ui/GlassCard";
import { PrioritySelector } from "@shared/ui/PrioritySelector";
import { Select } from "@shared/ui/Select";
import { TagInput } from "@shared/ui/TagInput";
import { TitleFieldWithLenght } from "@shared/ui/TitleFieldWithLenght";
import { ModalOverlay } from "@widgets/layout/ModalOverlay";

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
      return "Issue creata, ma primo commento/allegati non salvati (permessi insufficienti).";
    }

    const data = response.data;
    if (typeof data === "object" && data !== null) {
      if ("detail" in data && typeof (data as { detail?: unknown }).detail === "string") {
        return `Issue creata, ma primo commento/allegati non salvati: ${(data as { detail: string }).detail}`;
      }
      if ("file" in data && typeof (data as { file?: unknown }).file === "string") {
        return `Issue creata, ma primo commento/allegati non salvati: ${(data as { file: string }).file}`;
      }
    }
  }

  return "Issue creata, ma primo commento/allegati non salvati.";
}

export function IssueModal({ isOpen, onClose, mode, projectId, issue, initialData, onSuccess }: IssueModalProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category, setCategory] = useState(initialData?.type || CATEGORIES[0].value);
  const [priority, setPriority] = useState(initialData?.priority || "MEDIUM");
  const [status, setStatus] = useState(initialData?.status || STATUSES[0].value);
  const [tags, setTags] = useState<string[]>(initialData?.tags?.map((tag) => tag.name) || []);
  const [files, setFiles] = useState<File[]>([]);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [createdWithWarning, setCreatedWithWarning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      setCategory(initialData.type || CATEGORIES[0].value);
      setPriority(initialData.priority || "MEDIUM");
      setStatus(initialData.status || STATUSES[0].value);
      setTags(initialData.tags?.map((t) => t.name) || []);
      setFiles([]);
      setSubmitWarning(null);
      setCreatedWithWarning(false);
      return;
    }

    if (mode === "create") {
      setTitle("");
      setDescription("");
      setCategory(CATEGORIES[0].value);
      setPriority("MEDIUM");
      setStatus(STATUSES[0].value);
      setTags([]);
      setFiles([]);
      setSubmitWarning(null);
      setCreatedWithWarning(false);
    }
  }, [isOpen, initialData, mode]);

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

  const isFormValid = title.trim().length >= 3 && description.trim().length >= 5;

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
            const [firstFile, ...otherFiles] = files;
            const firstUpdate = await createIssueUpdateApi(resultIssue.issueId, {
              message: firstMessage,
              file: firstFile,
            });

            for (const file of otherFiles) {
              await uploadAttachmentApi(file, { updateId: firstUpdate.updateId });
            }
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

        if (resultIssue && files.length > 0) {
          for (const file of files) {
            await uploadAttachmentApi(file, { issueId: resultIssue.issueId });
          }
        }
      }

      return { warning };
    },
    onSuccess: (result) => {
      if (result.warning) {
        setSubmitWarning(result.warning);
        setCreatedWithWarning(true);
        return;
      }
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Failed to submit issue", error);
    },
  });

  const handleSubmit = () => {
    if (!isFormValid || submitMutation.isPending || createdWithWarning) return;
    submitMutation.mutate();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
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
              <TitleFieldWithLenght
                label="Title"
                title={title}
                onChangeTitle={setTitle}
                placeholder="What's the issue?"
                maxLength={30}
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

          <DescriptionFieldWithLenght
            label="Description"
            description={description}
            onChangeDescription={setDescription}
            placeholder="Provide more details about the issue..."
            maxLength={1000}
          />

          <FileAttachment onFilesChange={setFiles} />

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
              disabled={!isFormValid || submitMutation.isPending || !hasChanges || createdWithWarning}
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