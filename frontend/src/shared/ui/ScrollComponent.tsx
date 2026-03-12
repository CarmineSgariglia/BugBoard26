import type { ReactNode } from "react";

import { useFluidWheelContainer } from "@shared/hooks";

interface ScrollComponentProps {
    children: ReactNode;
    maxHeight?: string;
    className?: string;
    hideBorder?: boolean;
    smooth?: boolean;
}

export function ScrollComponent({
    children,
    maxHeight = "max-h-32",
    className = "",
    hideBorder = false,
    smooth = false,
}: ScrollComponentProps) {
    const scrollRef = useFluidWheelContainer<HTMLDivElement>(smooth);

    return (
        <div
            ref={scrollRef}
            className={`
                ${!hideBorder ? "border border-white/5 bg-[#121620]/50 rounded-xl" : ""} 
                p-4 ${maxHeight} overflow-y-auto custom-scrollbar ${smooth ? "smooth-scroll" : ""} ${className}
            `}
        >
            {children}
        </div>
    );
}
