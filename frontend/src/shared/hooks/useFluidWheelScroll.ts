import { useEffect, useRef } from "react";

const LINE_HEIGHT_PX = 16;
const DEFAULT_EASING = 0.08;
const MIN_DELTA = 0.1;

export type FluidWheelOptions = {
    easing?: number;
};

function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function normalizeDeltaY(deltaY: number, deltaMode: number, viewportHeight: number): number {
    if (deltaMode === 1) return deltaY * LINE_HEIGHT_PX;
    if (deltaMode === 2) return deltaY * viewportHeight;
    return deltaY;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function useFluidWheelContainer<T extends HTMLElement>(enabled = true, options: FluidWheelOptions = {}) {
    const ref = useRef<T | null>(null);
    const targetRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const easing = options.easing ?? DEFAULT_EASING;

    useEffect(() => {
        const element = ref.current;
        if (!enabled || !element || prefersReducedMotion()) return;

        targetRef.current = element.scrollTop;

        const onWheel = (event: WheelEvent) => {
            const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
            if (maxScrollTop <= 0) return;

            const deltaY = normalizeDeltaY(event.deltaY, event.deltaMode, element.clientHeight);
            if (Math.abs(deltaY) < MIN_DELTA) return;

            const currentScrollTop = element.scrollTop;
            const scrollingUpAtTop = deltaY < 0 && currentScrollTop <= 0;
            const scrollingDownAtBottom = deltaY > 0 && currentScrollTop >= maxScrollTop;
            if (scrollingUpAtTop || scrollingDownAtBottom) return;

            event.preventDefault();
            targetRef.current = clamp(targetRef.current + deltaY, 0, maxScrollTop);

            if (rafRef.current !== null) return;

            const step = () => {
                const current = element.scrollTop;
                const distance = targetRef.current - current;

                if (Math.abs(distance) < 0.5) {
                    element.scrollTop = targetRef.current;
                    rafRef.current = null;
                    return;
                }

                element.scrollTop = current + distance * easing;
                rafRef.current = window.requestAnimationFrame(step);
            };

            rafRef.current = window.requestAnimationFrame(step);
        };

        element.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            element.removeEventListener("wheel", onWheel);
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [enabled, easing]);

    return ref;
}

export function useFluidWheelWindow(enabled = true) {
    const targetRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled || prefersReducedMotion()) return;

        targetRef.current = window.scrollY;

        const onWheel = (event: WheelEvent) => {
            const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            if (maxScrollTop <= 0) return;

            const deltaY = normalizeDeltaY(event.deltaY, event.deltaMode, window.innerHeight);
            if (Math.abs(deltaY) < MIN_DELTA) return;

            const currentScrollTop = window.scrollY;
            const scrollingUpAtTop = deltaY < 0 && currentScrollTop <= 0;
            const scrollingDownAtBottom = deltaY > 0 && currentScrollTop >= maxScrollTop;
            if (scrollingUpAtTop || scrollingDownAtBottom) return;

            event.preventDefault();

            targetRef.current = clamp(targetRef.current + deltaY, 0, maxScrollTop);

            if (rafRef.current !== null) return;

            const step = () => {
                const current = window.scrollY;
                const distance = targetRef.current - current;

                if (Math.abs(distance) < 0.5) {
                    window.scrollTo({ top: targetRef.current, left: 0, behavior: "auto" });
                    rafRef.current = null;
                    return;
                }

                window.scrollTo({ top: current + distance * DEFAULT_EASING, left: 0, behavior: "auto" });
                rafRef.current = window.requestAnimationFrame(step);
            };

            rafRef.current = window.requestAnimationFrame(step);
        };

        window.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            window.removeEventListener("wheel", onWheel);
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [enabled]);
}
