import { GlassCard } from "./GlassCard";

interface LogoutConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function LogoutConfirmModal({ isOpen, onClose, onConfirm, isLoading }: LogoutConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={!isLoading ? onClose : undefined}
            />

            {/* Modal Content */}
            <div className="relative z-10 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                <GlassCard className="p-6">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mb-2">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold text-white mb-1">Sign Out</h3>
                            <p className="text-sm text-neutral-400">
                                Are you sure you want to log out of your account?
                            </p>
                        </div>

                        <div className="flex gap-3 w-full mt-2">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors disabled:opacity-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isLoading}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 transition-colors disabled:opacity-50 font-medium"
                            >
                                {isLoading ? "Logging out..." : "Log Out"}
                            </button>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
