import type { ReactNode } from "react";

interface GlassCardProps {
    children: ReactNode;
    className?: string;
}

/**
 * A highly reusable glassmorphic card component.
 * Uses a semi-transparent dark background, backdrop blur, and soft rounded corners.
 */
export function GlassCard({ children, className = "" }: GlassCardProps) {
    return (
        <div
            className={`w-full rounded-[24px] bg-[#1A1D24]/90 border border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col ${className}`}
        >
            {children}
        </div>
    );
}
