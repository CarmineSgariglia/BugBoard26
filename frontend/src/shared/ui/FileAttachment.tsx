import { FiUploadCloud, FiX, FiFile } from "react-icons/fi";
import { useFileValidation } from "../hooks/useFileValidation";
import { ATTACHMENT_FILE_INPUT_ACCEPT, formatBytes } from "../lib/media";

interface FileAttachmentProps {
    onFilesChange: (files: File[]) => void;
}

export function FileAttachment({ onFilesChange }: FileAttachmentProps) {
    const { files, error, isPreparingFiles, handleFiles, removeFile } = useFileValidation({
        maxFiles: 10,
        onFilesChange,
    });

    return (
        <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">File Attachment (Max 10 files)</label>

            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="group relative border-2 border-dashed border-white/5 bg-[#121620]/30 hover:border-[#5671F6]/50 hover:bg-[#5671F6]/5 rounded-xl p-8 transition-all cursor-pointer text-center"
            >
                <input
                    type="file"
                    multiple
                    accept={ATTACHMENT_FILE_INPUT_ACCEPT}
                    onChange={(e) => handleFiles(e.target.files)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2">
                    <FiUploadCloud size={32} className="text-neutral-500 group-hover:text-[#5671F6] transition-colors" />
                    <p className="text-sm text-neutral-400">
                        Drag files here or <span className="text-[#5671F6] font-medium">browse</span> to upload images, videos, PDFs, logs, JSON, CSV, ZIP
                    </p>
                </div>
            </div>

            {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
            {isPreparingFiles && <p className="text-xs text-sky-300 font-medium">Optimizing selected media...</p>}

            {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {files.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#1A1D24] border border-white/5 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-bottom-2">
                            <FiFile size={14} className="text-neutral-500" />
                            <span className="text-xs text-white/90 truncate max-w-[150px]">{file.name}</span>
                            <span className="text-[11px] text-neutral-500">{formatBytes(file.size)}</span>
                            <button onClick={() => removeFile(i)} className="text-neutral-500 hover:text-rose-400 ml-1">
                                <FiX size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
