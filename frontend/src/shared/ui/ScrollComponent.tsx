import type { ReactNode, Ref, UIEventHandler } from "react";

import { useFluidWheelContainer, type FluidWheelOptions } from "@shared/hooks";

interface ScrollComponentProps {
    children: ReactNode;
    maxHeight?: string;
    className?: string;
    hideBorder?: boolean;
    smooth?: boolean;
    wheelOptions?: FluidWheelOptions;
    onScroll?: UIEventHandler<HTMLDivElement>;
    testId?: string;
    containerRef?: Ref<HTMLDivElement>;
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
    if (!ref) {
        return;
    }

    if (typeof ref === "function") {
        ref(value);
        return;
    }

    (ref as { current: T | null }).current = value;
}

export function ScrollComponent({
    children,
    maxHeight = "max-h-32",
    className = "",
    hideBorder = false,
    smooth = false,
    wheelOptions,
    onScroll,
    testId,
    containerRef,
}: ScrollComponentProps) {
    const scrollRef = useFluidWheelContainer<HTMLDivElement>(smooth, wheelOptions);

    return (
        <div
            ref={(node) => {
                scrollRef.current = node;
                setRef(containerRef, node);
            }}
            onScroll={onScroll}
            data-testid={testId}
            className={`
                ${!hideBorder ? "border border-white/5 bg-[#121620]/50 rounded-xl" : ""} 
                p-4 ${maxHeight} overflow-y-auto custom-scrollbar ${className}
            `}
        >
            {children}
        </div>
    );
}
