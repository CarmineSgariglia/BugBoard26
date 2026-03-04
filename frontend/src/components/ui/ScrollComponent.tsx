import type { ReactNode } from "react";

interface ScrollComponentProps {
    children: ReactNode;
    maxHeight?: string;
    className?: string;
    hideBorder?: boolean;
}

export function ScrollComponent({
    children,
    maxHeight = "max-h-32",
    className = "",
    hideBorder = false
}: ScrollComponentProps) {
    return (
        <div
            className={`
                ${!hideBorder ? "border border-white/5 bg-[#121620]/50 rounded-xl" : ""} 
                p-4 ${maxHeight} overflow-y-auto custom-scrollbar ${className}
            `}
        >
            {children}
        </div>
    );
}