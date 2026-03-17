import React from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "@shared/hooks/useLockBodyScroll";

interface ModalOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string; // e.g., "max-w-4xl", "max-w-xl"
    className?: string; // Add custom classes to the inner container
}

export function ModalOverlay({
    isOpen,
    onClose,
    children,
    maxWidth = "max-w-4xl",
    className = "",
}: ModalOverlayProps) {
    // Lock body scroll when the modal is open
    useLockBodyScroll(isOpen);

    if (!isOpen) return null;

    const overlayContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D12]/90 backdrop-blur-sm p-4">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

            {/* Modal Content Container */}
            <div className={`w-full ${maxWidth} relative animate-in fade-in zoom-in duration-200 z-10 ${className}`}>
                {children}
            </div>
        </div>
    );

    return createPortal(overlayContent, document.body);
}
