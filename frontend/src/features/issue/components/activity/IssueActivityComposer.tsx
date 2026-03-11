import { useRef } from "react";
import { FiPaperclip, FiSend, FiX } from "react-icons/fi";
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
                    textareaClassName="min-h-[44px] max-h-40 rounded-xl bg-[#121620] border-white/10 px-3 py-2 text-sm placeholder:text-neutral-500"
                    counterClassName="text-neutral-500"
                />
                <Button
                    type="button"
                    variant="primary"
                    fullWidth={false}
                    disabled={!message.trim() || isSubmitting}
                    isLoading={isSubmitting}
                    onClick={onSubmit}
                    icon={<FiSend size={14} />}
                >
                    Send
                </Button>
            </div>

            <div className="mt-2 flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-neutral-300 hover:text-white inline-flex items-center gap-1"
                >
                    <FiPaperclip size={14} />
                    Add file
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        const next = e.target.files ? Array.from(e.target.files) : [];
                        onFilesChange(next);
                    }}
                />

                {files.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {files.slice(0, 3).map((f, idx) => (
                            <span
                                key={`${f.name}-${idx}`}
                                className="text-xs px-2 py-1 rounded border border-white/15 text-neutral-200 inline-flex items-center gap-1"
                            >
                                {f.name}
                                <button
                                    type="button"
                                    onClick={() => onFilesChange(files.filter((_, i) => i !== idx))}
                                    className="text-neutral-400 hover:text-white"
                                >
                                    <FiX size={12} />
                                </button>
                            </span>
                        ))}
                        {files.length > 3 && <span className="text-xs text-neutral-400">+{files.length - 3} more</span>}
                    </div>
                )}
            </div>
        </div>
    );
}
