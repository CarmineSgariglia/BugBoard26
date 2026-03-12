import { useEffect, useRef, type MutableRefObject } from "react";

const LINE_HEIGHT_PX = 16;
const EASING = 0.16;
const MIN_DELTA = 0.1;

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

function animateScrollStep(
    getCurrent: () => number,
    setCurrent: (value: number) => void,
    targetRef: MutableRefObject<number>,
    rafRef: MutableRefObject<number | null>
) {
    if (rafRef.current !== null) return;

    const step = () => {
        const current = getCurrent();
        const distance = targetRef.current - current;

        if (Math.abs(distance) < 0.5) {
            setCurrent(targetRef.current);
            rafRef.current = null;
            return;
        }

        setCurrent(current + distance * EASING);
        rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
}

export function useFluidWheelContainer<T extends HTMLElement>(enabled = true) {
    const ref = useRef<T | null>(null);
    const targetRef = useRef(0);
    const rafRef = useRef<number | null>(null);

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

            animateScrollStep(
                () => element.scrollTop,
                (value) => {
                    element.scrollTop = value;
                },
                targetRef,
                rafRef
            );
        };

        element.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            element.removeEventListener("wheel", onWheel);
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [enabled]);

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

            animateScrollStep(
                () => window.scrollY,
                (value) => {
                    window.scrollTo({ top: value, left: 0, behavior: "auto" });
                },
                targetRef,
                rafRef
            );
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

