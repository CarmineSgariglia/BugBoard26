/*
* File Validation Hook
* 
* This hook is used to validate files that are uploaded by the user.
* It checks if the files are valid and if they are within the allowed size limit.
* It also checks if the number of files is within the allowed limit.
*/

import { useCallback, useState, useEffect } from "react";

interface UseFileValidationOptions {
    maxFiles?: number;
    maxSizeMB?: number;
    onFilesChange?: (files: File[]) => void;
    initialFiles?: File[];
}

const EMPTY_FILES: File[] = [];

export function useFileValidation({
    maxFiles = 10,
    maxSizeMB = 10,
    onFilesChange,
    initialFiles = EMPTY_FILES,
}: UseFileValidationOptions = {}) {
    const [files, setFiles] = useState<File[]>(initialFiles);
    const [error, setError] = useState<string | null>(null);

    const handleFiles = useCallback(
        (newFiles: FileList | File[] | null) => {
            if (!newFiles) return;
            setError(null);

            const incomingFiles = Array.isArray(newFiles) ? newFiles : Array.from(newFiles);
            const validFiles: File[] = [];
            let sizeErrorTriggered = false;

            const maxSizeBytes = maxSizeMB * 1024 * 1024;

            for (const file of incomingFiles) {
                if (file.size > maxSizeBytes) {
                    sizeErrorTriggered = true;
                } else {
                    validFiles.push(file);
                }
            }

            const totalAfterAddition = files.length + validFiles.length;
            const canAddCount = maxFiles - files.length;
            const acceptedFiles = validFiles.slice(0, Math.max(0, canAddCount));

            const limitErrorTriggered = totalAfterAddition > maxFiles;

            if (sizeErrorTriggered && limitErrorTriggered) {
                setError(`Max ${maxFiles} files allowed, some were discarded. Excluded files exceeding ${maxSizeMB}MB.`);
            } else if (sizeErrorTriggered) {
                setError(`Excluded files exceeding the ${maxSizeMB}MB size limit.`);
            } else if (limitErrorTriggered) {
                setError(`Max ${maxFiles} files allowed. Extra files were discarded.`);
            }

            if (acceptedFiles.length > 0) {
                const updatedFiles = [...files, ...acceptedFiles];
                setFiles(updatedFiles);
                if (onFilesChange) {
                    onFilesChange(updatedFiles);
                }
            }
        },
        [files, maxFiles, maxSizeMB, onFilesChange]
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
        handleFiles,
        removeFile,
        resetFiles,
    };
}
