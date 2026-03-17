import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiExternalLink, FiX } from "react-icons/fi";

import type { IssueAttachment } from "@shared/api/types/issues";
import { resolveMediaUrl } from "@shared/api/core/media";
import {
    getAttachmentDisplayName,
    getAttachmentPreviewKind,
} from "@shared/lib/media";
import { ModalOverlay } from "@widgets/layout/ModalOverlay";

type Props = {
    attachment: IssueAttachment | null;
    onClose: () => void;
};

export function IssueAttachmentPreviewModal({ attachment, onClose }: Props) {
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [textContent, setTextContent] = useState("");
    const [textError, setTextError] = useState<string | null>(null);
    const [isTextLoading, setIsTextLoading] = useState(false);

    const resolvedUrl = useMemo(
        () => resolveMediaUrl(attachment?.url || attachment?.path || ""),
        [attachment],
    );
    const previewKind = useMemo(
        () => (attachment ? getAttachmentPreviewKind(attachment) : "unsupported"),
        [attachment],
    );
    const displayName = useMemo(
        () => (attachment ? getAttachmentDisplayName(attachment) : ""),
        [attachment],
    );
    const fetchCredentials = useMemo<RequestCredentials>(() => {
        if (!resolvedUrl || typeof window === "undefined") {
            return "same-origin";
        }

        try {
            const resolvedLocation = new URL(resolvedUrl, window.location.origin);
            return resolvedLocation.origin === window.location.origin ? "include" : "omit";
        } catch {
            return "same-origin";
        }
    }, [resolvedUrl]);

    useEffect(() => {
        if (!attachment || previewKind !== "pdf" || !resolvedUrl) {
            setPdfPreviewUrl((currentUrl) => {
                if (currentUrl) {
                    URL.revokeObjectURL(currentUrl);
                }
                return "";
            });
            setPdfError(null);
            setIsPdfLoading(false);
            return;
        }

        const controller = new AbortController();
        let objectUrl = "";

        async function loadPdfPreview() {
            setIsPdfLoading(true);
            setPdfError(null);

            try {
                const response = await fetch(resolvedUrl, {
                    credentials: fetchCredentials,
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
                setPdfPreviewUrl((currentUrl) => {
                    if (currentUrl) {
                        URL.revokeObjectURL(currentUrl);
                    }
                    return objectUrl;
                });
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error("Failed to load PDF preview", error);
                    setPdfError("Unable to load PDF preview.");
                    setPdfPreviewUrl((currentUrl) => {
                        if (currentUrl) {
                            URL.revokeObjectURL(currentUrl);
                        }
                        return "";
                    });
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsPdfLoading(false);
                }
            }
        }

        void loadPdfPreview();

        return () => {
            controller.abort();
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [attachment, fetchCredentials, previewKind, resolvedUrl]);

    useEffect(() => {
        if (!attachment || previewKind !== "text" || !resolvedUrl) {
            setTextContent("");
            setTextError(null);
            setIsTextLoading(false);
            return;
        }

        const controller = new AbortController();

        async function loadTextPreview() {
            setIsTextLoading(true);
            setTextError(null);

            try {
                const response = await fetch(resolvedUrl, {
                    credentials: fetchCredentials,
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const content = await response.text();
                setTextContent(content);
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error("Failed to load attachment preview", error);
                    setTextError("Unable to load preview for this file.");
                    setTextContent("");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsTextLoading(false);
                }
            }
        }

        void loadTextPreview();

        return () => controller.abort();
    }, [attachment, fetchCredentials, previewKind, resolvedUrl]);

    if (!attachment) {
        return null;
    }

    return (
        <ModalOverlay isOpen={Boolean(attachment)} onClose={onClose} maxWidth="max-w-5xl">
            <div className="rounded-3xl border border-white/10 bg-[#0F1724] shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                    <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-white">{displayName}</h3>
                        <p className="text-xs text-neutral-400">{attachment.mimeType || "Unknown file type"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={resolvedUrl}
                            download={displayName}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-100 transition hover:bg-white/5"
                        >
                            <FiDownload size={15} />
                            Download
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-white/10 p-2 text-neutral-300 transition hover:bg-white/5 hover:text-white"
                            aria-label="Close preview"
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                <div className="max-h-[78vh] min-h-[300px] overflow-auto bg-[#0B111B]">
                    {previewKind === "image" ? (
                        <div className="flex min-h-[300px] items-center justify-center p-4">
                            <img
                                src={resolvedUrl}
                                alt={displayName}
                                className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain"
                            />
                        </div>
                    ) : null}

                    {previewKind === "video" ? (
                        <div className="flex min-h-[300px] items-center justify-center p-4">
                            <video
                                src={resolvedUrl}
                                controls
                                className="max-h-[72vh] w-full rounded-2xl bg-black object-contain"
                            >
                                Your browser does not support video preview.
                            </video>
                        </div>
                    ) : null}

                    {previewKind === "pdf" ? (
                        <div className="h-[78vh] min-h-[500px]">
                            {isPdfLoading ? (
                                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                                    Loading PDF preview...
                                </div>
                            ) : null}

                            {!isPdfLoading && pdfError ? (
                                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-neutral-300">
                                    <p>{pdfError}</p>
                                    <a
                                        href={resolvedUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-100 transition hover:bg-white/5"
                                    >
                                        <FiExternalLink size={15} />
                                        Open file
                                    </a>
                                </div>
                            ) : null}

                            {!isPdfLoading && !pdfError && pdfPreviewUrl ? (
                                <iframe
                                    title={`Preview of ${displayName}`}
                                    src={pdfPreviewUrl}
                                    className="h-full w-full"
                                />
                            ) : null}
                        </div>
                    ) : null}

                    {previewKind === "text" ? (
                        <div className="p-4">
                            {isTextLoading ? (
                                <div className="flex min-h-[220px] items-center justify-center text-sm text-neutral-400">
                                    Loading preview...
                                </div>
                            ) : null}

                            {!isTextLoading && textError ? (
                                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-neutral-300">
                                    <p>{textError}</p>
                                    <a
                                        href={resolvedUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-100 transition hover:bg-white/5"
                                    >
                                        <FiExternalLink size={15} />
                                        Open file
                                    </a>
                                </div>
                            ) : null}

                            {!isTextLoading && !textError ? (
                                <pre className="overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-[#101826] p-4 font-mono text-xs leading-6 text-neutral-100">
                                    {textContent}
                                </pre>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </ModalOverlay>
    );
}
