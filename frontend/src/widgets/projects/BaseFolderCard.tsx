import type { ReactNode } from "react";

export interface BaseFolderCardProps {
    color: string;
    children: ReactNode;
    onClick?: () => void;
    className?: string; // Additional classes for the inner container if needed
}

export function BaseFolderCard({
    color,
    children,
    onClick,
    className = "",
}: BaseFolderCardProps) {
    return (
        <button
            onClick={onClick}
            className="group relative w-full h-full flex flex-col text-left outline-none transition-transform hover:-translate-y-1 hover:shadow-2xl focus:ring-2 focus:ring-white/20 rounded-2xl"
        >
            {/* The Back Tab (Folder Tab) */}
            <div
                className="absolute left-0 top-0 h-8 w-[40%] rounded-t-xl transition-colors"
                style={{
                    backgroundColor: color,
                    filter: "brightness(0.75)", // Darken the tab to simulate physical depth
                }}
            />

            {/* The Light Lip (Middle Layer Highlight) */}
            <div
                className="absolute left-0 right-0 top-[10px] h-6 rounded-t-2xl transition-colors z-0"
                style={{
                    backgroundColor: color,
                    filter: "brightness(1.15)", // Lighter version of the base color
                }}
            />

            {/* The Main Front Body of the Folder */}
            <div
                className={`relative z-10 mt-[14px] flex flex-1 w-full rounded-2xl border border-white/20 shadow-xl transition-colors min-h-[220px] ${className}`}
                style={{ backgroundColor: color }}
            >
                {children}
            </div>
        </button>
    );
}
