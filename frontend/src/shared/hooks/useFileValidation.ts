import { useCallback, useState, useEffect } from "react";
import { prepareAttachmentUpload } from "../lib/media";

interface UseFileValidationOptions {
    maxFiles?: number;
    onFilesChange?: (files: File[]) => void;
    initialFiles?: File[];
}

const EMPTY_FILES: File[] = [];

export function useFileValidation({
    maxFiles = 10,
    onFilesChange,
    initialFiles = EMPTY_FILES,
}: UseFileValidationOptions = {}) {
    const [files, setFiles] = useState<File[]>(initialFiles);
    const [error, setError] = useState<string | null>(null);
    const [isPreparingFiles, setIsPreparingFiles] = useState(false);

    const handleFiles = useCallback(
        async (newFiles: FileList | File[] | null) => {
            if (!newFiles) return;
            setError(null);
            setIsPreparingFiles(true);

            try {
                const incomingFiles = Array.isArray(newFiles) ? newFiles : Array.from(newFiles);
                const validFiles: File[] = [];
                const fileErrors: string[] = [];

                for (const incomingFile of incomingFiles) {
                    try {
                        const preparedFile = await prepareAttachmentUpload(incomingFile);
                        validFiles.push(preparedFile);
                    } catch (err) {
                        const message = err instanceof Error ? err.message : "Some files were discarded.";
                        if (!fileErrors.includes(message)) {
                            fileErrors.push(message);
                        }
                    }
                }

                const totalAfterAddition = files.length + validFiles.length;
                const canAddCount = maxFiles - files.length;
                const acceptedFiles = validFiles.slice(0, Math.max(0, canAddCount));
                const limitErrorTriggered = totalAfterAddition > maxFiles;

                if (limitErrorTriggered) {
                    fileErrors.push(`Max ${maxFiles} files allowed. Extra files were discarded.`);
                }

                if (acceptedFiles.length > 0) {
                    const updatedFiles = [...files, ...acceptedFiles];
                    setFiles(updatedFiles);
                    if (onFilesChange) {
                        onFilesChange(updatedFiles);
                    }
                }

                setError(fileErrors.length > 0 ? fileErrors.join(" ") : null);
            } finally {
                setIsPreparingFiles(false);
            }
        },
        [files, maxFiles, onFilesChange]
    );

    const removeFile = useCallback(
        (index: number) => {
            setError(null);
            const updatedFiles = files.filter((_, i) => i !== index);
            setFiles(updatedFiles);
            if (onFilesChange) {
                onFilesChange(updatedFiles);
            }
        },
        [files, onFilesChange]
    );

    const resetFiles = useCallback(() => {
        setFiles([]);
        setError(null);
        if (onFilesChange) {
            onFilesChange([]);
        }
    }, [onFilesChange]);

    useEffect(() => {
        setFiles(initialFiles);
    }, [initialFiles]);

    return {
        files,
        error,
        isPreparingFiles,
        handleFiles,
        removeFile,
        resetFiles,
    };
}
