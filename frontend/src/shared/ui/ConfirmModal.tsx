import React from "react";
import { createPortal } from "react-dom"; // Importo createPortal per renderizzare il modal nel DOM root
import { GlassCard } from "./GlassCard";
import { Button } from "./Button";
import { useLockBodyScroll } from "../../shared/hooks/useLockBodyScroll";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: React.ReactNode;
    icon: React.ReactNode;
    confirmText: string;
    confirmVariant?: "primary" | "glass" | "destructive" | "ghost";
    isLoading?: boolean;
    danger?: boolean; // Se true, l'icona e il tasto avranno toni rossi
}

export function ConfirmModal({
    isOpen, onClose, onConfirm, title, description, icon, confirmText, confirmVariant = "primary", isLoading, danger
}: ConfirmModalProps) {
    // Prevent background scrolling using our reusable hook
    useLockBodyScroll(isOpen);

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop sfocato */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={!isLoading ? onClose : undefined}
            />

            {/* Contenuto Modal */}
            <div className="relative z-10 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                <GlassCard className="p-6">
                    <div className="flex flex-col items-center text-center gap-4">
                        {/* Icona */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${danger ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"}`}>
                            {icon}
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold text-white mb-1">{title}</h3>
                            <div className="text-sm text-neutral-400">
                                {description}
                            </div>
                        </div>

                        <div className="flex gap-3 w-full mt-2">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 py-2.5 rounded-xl border border-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={onConfirm}
                                disabled={isLoading}
                                isLoading={isLoading}
                                variant={danger ? "destructive" : confirmVariant}
                                className="flex-1 py-2.5 rounded-xl font-medium"
                            >
                                {confirmText}
                            </Button>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
