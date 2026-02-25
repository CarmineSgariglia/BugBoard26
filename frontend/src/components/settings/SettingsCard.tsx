import type { ReactNode } from "react";

interface SettingsCardProps {
    children: ReactNode;
    className?: string; // Permit passing down custom width
}

export function SettingsCard({ children, className = "" }: SettingsCardProps) {
    return (
        <div className={`w-full rounded-2xl bg-[#1A1D24]/90 border border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl shrink-0 ${className || 'max-w-lg'}`}>
            {children}
        </div>
    );
}
