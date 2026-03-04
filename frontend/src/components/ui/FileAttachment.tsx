import React, { useCallback, useState } from "react";
import { FiUploadCloud, FiX, FiFile } from "react-icons/fi";

interface FileAttachmentProps {
    onFilesChange: (files: File[]) => void;
    maxSizeMB?: number;
}

export function FileAttachment({ onFilesChange, maxSizeMB = 10 }: FileAttachmentProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleFiles = useCallback((newFiles: FileList | null) => {
        if (!newFiles) return;
        setError(null);

        const validFiles: File[] = [];
        const maxSize = maxSizeMB * 1024 * 1024;

        Array.from(newFiles).forEach(file => {
            if (file.size > maxSize) {
                setError(`File too large (Max ${maxSizeMB}MB)`);
            } else {
                validFiles.push(file);
            }
        });

        const updatedFiles = [...files, ...validFiles];
        setFiles(updatedFiles);
        onFilesChange(updatedFiles);
    }, [files, maxSizeMB, onFilesChange]);

    const removeFile = (index: number) => {
        const updatedFiles = files.filter((_, i) => i !== index);
        setFiles(updatedFiles);
        onFilesChange(updatedFiles);
    };

    return (
        <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">File Attachment</label>

            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="group relative border-2 border-dashed border-white/5 bg-[#121620]/30 hover:border-[#5671F6]/50 hover:bg-[#5671F6]/5 rounded-xl p-8 transition-all cursor-pointer text-center"
            >
                <input
                    type="file"
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2">
                    <FiUploadCloud size={32} className="text-neutral-500 group-hover:text-[#5671F6] transition-colors" />
                    <p className="text-sm text-neutral-400">
                        Drag and drop files here or <span className="text-[#5671F6] font-medium">browse</span> to upload
                    </p>
                </div>
            </div>

            {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

            {/* List of uploaded files */}
            {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {files.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#1A1D24] border border-white/5 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-bottom-2">
                            <FiFile size={14} className="text-neutral-500" />
                            <span className="text-xs text-white/90 truncate max-w-[150px]">{file.name}</span>
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
