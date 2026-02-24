import type { ReactNode } from "react";

interface GlassCardProps {
    children: ReactNode;
    className?: string;
}

export function GlassCard({ children, className = "" }: GlassCardProps) {
    return (
        <div
            className={`bg-neutral-900/80 backdrop-blur-2xl border border-white/10 rounded-[24px] p-2 shadow-2xl flex flex-col gap-2 ${className}`}
        >
            {children}
        </div>
    );
}
