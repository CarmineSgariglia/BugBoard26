import type { ReactNode } from "react";

import { useFluidWheelContainer, type FluidWheelOptions } from "@shared/hooks";

interface ScrollComponentProps {
    children: ReactNode;
    maxHeight?: string;
    className?: string;
    hideBorder?: boolean;
    smooth?: boolean;
    wheelOptions?: FluidWheelOptions;
}

export function ScrollComponent({
    children,
    maxHeight = "max-h-32",
    className = "",
    hideBorder = false,
    smooth = false,
    wheelOptions,
}: ScrollComponentProps) {
    const scrollRef = useFluidWheelContainer<HTMLDivElement>(smooth, wheelOptions);

    return (
        <div
            ref={scrollRef}
            className={`
                ${!hideBorder ? "border border-white/5 bg-[#121620]/50 rounded-xl" : ""} 
                p-4 ${maxHeight} overflow-y-auto custom-scrollbar ${className}
            `}
        >
            {children}
        </div>
    );
}
