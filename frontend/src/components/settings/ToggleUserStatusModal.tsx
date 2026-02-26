import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";
import { MdGroupOff } from "react-icons/md";
import { MdGroup } from "react-icons/md";
import type { AuthUser } from "../../services/api";

interface ToggleUserStatusModalProps {
    isOpen: boolean;
    user: AuthUser | null;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function ToggleUserStatusModal({ isOpen, user, onClose, onConfirm, isLoading }: ToggleUserStatusModalProps) {
    if (!isOpen || !user) return null;

    const isActive = user.active ?? true;
    const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username;

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
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${isActive ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"}`}>
                            {isActive ? <MdGroupOff size={24} /> : <MdGroup size={24} />}
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold text-white mb-1">
                                {isActive ? "Deactivate User" : "Activate User"}
                            </h3>
                            <p className="text-sm text-neutral-400">
                                Are you sure you want to {isActive ? "deactivate" : "activate"}{" "}
                                <span className="text-white font-medium">{fullName}</span>?
                                {isActive
                                    ? " They will no longer be able to access the system."
                                    : " They will regain access to the system."}
                            </p>
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
                                className={`flex-1 py-2.5 rounded-xl font-medium ${isActive
                                    ? "bg-red-500 hover:bg-red-600"
                                    : "bg-emerald-500 hover:bg-emerald-600"
                                    }`}
                            >
                                {isActive ? "Deactivate" : "Activate"}
                            </Button>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
