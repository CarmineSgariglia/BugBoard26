import { useEffect, useId, useRef, useState } from "react";
import { FiInfo } from "react-icons/fi";

import {
    ATTACHMENT_INFO_SECTIONS,
    ATTACHMENT_MAX_FILE_BYTES,
    ATTACHMENT_MAX_FILES,
    ATTACHMENT_MAX_VIDEO_BYTES,
    formatBytes,
} from "../lib/media";

type Props = {
    className?: string;
    align?: "left" | "right";
};

export function AttachmentUploadInfoPopover({
    className = "",
    align = "left",
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const popoverId = useId();

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handlePointerDown(event: MouseEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div ref={containerRef} className={`relative inline-flex ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-neutral-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Accepted file formats and limits"
                aria-expanded={isOpen}
                aria-controls={popoverId}
            >
                <FiInfo size={13} />
            </button>

            {isOpen ? (
                <div
                    id={popoverId}
                    className={`absolute bottom-0 z-30 w-72 rounded-2xl border border-white/10 bg-[#121826] p-4 text-xs text-neutral-200 shadow-2xl ${
                        align === "right" ? "right-full mr-2" : "left-full ml-2"
                    }`}
                >
                    <p className="mb-3 text-sm font-semibold text-white">Accepted uploads</p>

                    <div className="space-y-2">
                        {ATTACHMENT_INFO_SECTIONS.map((section) => (
                            <div key={section.title}>
                                <p className="font-medium text-neutral-100">{section.title}</p>
                                <p className="text-neutral-400">{section.items.join(", ")}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-neutral-300">
                        <p>{`Max file/image size: ${formatBytes(ATTACHMENT_MAX_FILE_BYTES)}`}</p>
                        <p>{`Max video size: ${formatBytes(ATTACHMENT_MAX_VIDEO_BYTES)}`}</p>
                        <p>{`Up to ${ATTACHMENT_MAX_FILES} files per comment`}</p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
