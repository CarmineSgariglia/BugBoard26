import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface ScrollableCellProps {
    children: ReactNode;
    className?: string;
}

export function ScrollableCell({ children, className = "" }: ScrollableCellProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        checkScroll();
        const observer = new ResizeObserver(checkScroll);
        observer.observe(el);
        return () => observer.disconnect();
    }, [checkScroll, children]);

    const scroll = (direction: "left" | "right") => {
        ref.current?.scrollBy({ left: direction === "left" ? -80 : 80, behavior: "smooth" });
    };

    const showArrows = canScrollLeft || canScrollRight;

    return (
        <div className={`relative flex items-center gap-0.5 w-full ${className}`}>
            <button
                type="button"
                onClick={() => scroll("left")}
                className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full transition-all ${!showArrows ? "opacity-0 pointer-events-none" : canScrollLeft
                    ? "text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
                    : "text-neutral-700 cursor-default"
                    }`}
                tabIndex={-1}
            >
                <FiChevronLeft size={10} />
            </button>

            <div
                ref={ref}
                className="min-w-0 flex-1 overflow-x-auto no-scrollbar"
                onScroll={checkScroll}
            >
                {children}
            </div>

            <button
                type="button"
                onClick={() => scroll("right")}
                className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full transition-all ${!showArrows ? "opacity-0 pointer-events-none" : canScrollRight
                    ? "text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
                    : "text-neutral-700 cursor-default"
                    }`}
                tabIndex={-1}
            >
                <FiChevronRight size={10} />
            </button>
        </div>
    );
}
