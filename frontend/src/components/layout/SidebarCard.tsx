import { type ReactNode } from "react";

interface SidebarCardProps {
    children: ReactNode;
    className?: string;
}

export function SidebarCard({ children, className = "" }: SidebarCardProps) {
    return (
        <div className={`flex flex-col gap-8 p-6 rounded-2xl border border-white/5 bg-[#121620]/20 h-fit ${className}`}>
            {children}
        </div>
    );
}

// Sottocomponente per le sezioni interne (es. "Description", "Members")
SidebarCard.Section = function SidebarSection({
    title,
    children,
    className = ""
}: {
    title: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">
                {title}
            </h4>
            <div className="flex flex-col gap-2">
                {children}
            </div>
        </div>
    );
};
