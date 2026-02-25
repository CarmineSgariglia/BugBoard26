import type { ReactNode } from "react";

interface SettingsCardProps {
    children: ReactNode;
}

export function SettingsCard({ children }: SettingsCardProps) {
    return (
        <div className="w-full max-w-lg rounded-2xl bg-[#1A1D24]/90 border border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl shrink-0">
            {children}
        </div>
    );
}
