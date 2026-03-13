import { useRef, useState } from "react";
import { FiPaperclip, FiSend, FiX, FiAlertCircle } from "react-icons/fi";
import { useFileValidation } from "@shared/hooks/useFileValidation";
import { ATTACHMENT_FILE_INPUT_ACCEPT, ATTACHMENT_MAX_FILES, formatBytes } from "@shared/lib/media";
import { AttachmentUploadInfoPopover } from "@shared/ui/AttachmentUploadInfoPopover";
import { Button } from "@shared/ui/Button";
import { DescriptionFieldWithLenght } from "@shared/ui/DescriptionFieldWithLenght";

type Props = {
    message: string;
    onMessageChange: (v: string) => void;
    files: File[];
    onFilesChange: (files: File[]) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
};

export function IssueActivityComposer({
    message,
    onMessageChange,
    files,
    onFilesChange,
    onSubmit,
    isSubmitting,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [showAllFiles, setShowAllFiles] = useState(false);

    const { error: fileError, isPreparingFiles, handleFiles, removeFile } = useFileValidation({
        maxFiles: ATTACHMENT_MAX_FILES,
        initialFiles: files,
        onFilesChange: onFilesChange,
    });

    return (
        <div className="border-t border-white/10 bg-[#0D1322] p-3">
            <div className="flex gap-2 items-start">
                <DescriptionFieldWithLenght
                    description={message}
                    onChangeDescription={onMessageChange}
                    maxLength={1000}
                    label="Comment"
                    hideLabel={true}
                    placeholder="Add a comment..."
                    containerClassName="flex-1"
                    textareaClassName="min-h-[38px] h-[38px] max-h-40 rounded-xl bg-[#121620] border-white/10 px-3 py-2 leading-[20px] text-sm placeholder:text-neutral-500"
                    counterClassName="text-neutral-500"
                />
                <Button
                    type="button"
                    variant="primary"
                    fullWidth={false}
                    disabled={!message.trim() || isSubmitting || isPreparingFiles}
                    isLoading={isSubmitting}
                    onClick={onSubmit}
                    icon={<FiSend size={14} />}
                >
                    Send
                </Button>
            </div>

            {fileError && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400">
                    <FiAlertCircle size={14} />
                    {fileError}
                </div>
            )}

            <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-neutral-300 hover:text-white inline-flex items-center gap-1"
                    >
                        <FiPaperclip size={14} />
                        {`Add media/file (max ${ATTACHMENT_MAX_FILES})`}
                    </button>
                    <AttachmentUploadInfoPopover />
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ATTACHMENT_FILE_INPUT_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                        handleFiles(e.target.files);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                        }
                    }}
                    />

                {isPreparingFiles ? <span className="text-xs text-sky-300">Optimizing media...</span> : null}

                {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                        {(showAllFiles ? files : files.slice(0, 3)).map((f, idx) => (
                            <span
                                key={`${f.name}-${idx}`}
                                className="text-xs px-2 py-1 rounded border border-white/15 text-neutral-200 inline-flex items-center gap-1"
                            >
                                {f.name} ({formatBytes(f.size)})
                                <button
                                    type="button"
                                    onClick={() => {
                                        removeFile(idx);
                                        if (files.length - 1 <= 3) setShowAllFiles(false);
                                    }}
                                    className="text-neutral-400 hover:text-white"
                                >
                                    <FiX size={12} />
                                </button>
                            </span>
                        ))}
                        {!showAllFiles && files.length > 3 && (
                            <button
                                type="button"
                                onClick={() => setShowAllFiles(true)}
                                className="text-xs text-neutral-400 hover:text-white hover:underline transition-colors"
                            >
                                +{files.length - 3} more
                            </button>
                        )}
                        {showAllFiles && files.length > 3 && (
                            <button
                                type="button"
                                onClick={() => setShowAllFiles(false)}
                                className="text-xs text-neutral-400 hover:text-white hover:underline transition-colors ml-1"
                            >
                                Show less
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
