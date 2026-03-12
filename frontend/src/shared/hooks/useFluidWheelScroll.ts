import { useEffect, useRef } from "react";

const LINE_HEIGHT_PX = 16;
const DEFAULT_EASING = 0.08;
const MIN_DELTA = 0.1;
const DEFAULT_TAIL_DURATION_MS = 900;
const DEFAULT_TAIL_INTENSITY = 0.26;
const DEFAULT_IDLE_MS = 110;
const DEFAULT_TAIL_MAX_PX = 120;

export type FluidWheelOptions = {
    tailDurationMs?: number;
    tailIntensity?: number;
    idleMs?: number;
    tailMaxPx?: number;
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
    const tailRafRef = useRef<number | null>(null);
    const idleTimerRef = useRef<number | null>(null);
    const interactionIdRef = useRef(0);
    const lastDeltaRef = useRef(0);
    const tailDurationMs = options.tailDurationMs ?? DEFAULT_TAIL_DURATION_MS;
    const tailIntensity = options.tailIntensity ?? DEFAULT_TAIL_INTENSITY;
    const idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
    const tailMaxPx = options.tailMaxPx ?? DEFAULT_TAIL_MAX_PX;

    useEffect(() => {
        const element = ref.current;
        if (!enabled || !element || prefersReducedMotion()) return;

        const cancelTailAnimation = () => {
            if (tailRafRef.current !== null) {
                window.cancelAnimationFrame(tailRafRef.current);
                tailRafRef.current = null;
            }
        };

        const clearIdleTimer = () => {
            if (idleTimerRef.current !== null) {
                window.clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
        };

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

        const startTailAnimation = (interactionId: number) => {
            const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
            if (maxScrollTop <= 0) return;

            const from = element.scrollTop;
            const intendedDelta = clamp(lastDeltaRef.current * tailIntensity, -tailMaxPx, tailMaxPx);
            const to = clamp(from + intendedDelta, 0, maxScrollTop);
            if (Math.abs(to - from) < 0.5) return;

            const startTime = performance.now();
            const duration = Math.max(120, tailDurationMs);

            const step = (now: number) => {
                if (interactionId !== interactionIdRef.current) {
                    tailRafRef.current = null;
                    return;
                }

                const progress = clamp((now - startTime) / duration, 0, 1);
                element.scrollTop = from + (to - from) * easeOutCubic(progress);

                if (progress >= 1) {
                    tailRafRef.current = null;
                    return;
                }

                tailRafRef.current = window.requestAnimationFrame(step);
            };

            tailRafRef.current = window.requestAnimationFrame(step);
        };

        const onWheel = (event: WheelEvent) => {
            const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
            if (maxScrollTop <= 0) return;

            const deltaY = normalizeDeltaY(event.deltaY, event.deltaMode, element.clientHeight);
            if (Math.abs(deltaY) < MIN_DELTA) return;

            const currentScrollTop = element.scrollTop;
            const scrollingUpAtTop = deltaY < 0 && currentScrollTop <= 0;
            const scrollingDownAtBottom = deltaY > 0 && currentScrollTop >= maxScrollTop;
            if (scrollingUpAtTop || scrollingDownAtBottom) return;

            interactionIdRef.current += 1;
            const currentInteractionId = interactionIdRef.current;
            lastDeltaRef.current = deltaY;

            cancelTailAnimation();
            clearIdleTimer();

            idleTimerRef.current = window.setTimeout(() => {
                startTailAnimation(currentInteractionId);
            }, Math.max(16, idleMs));
        };

        const onInteractionStart = () => {
            interactionIdRef.current += 1;
            cancelTailAnimation();
            clearIdleTimer();
        };

        element.addEventListener("wheel", onWheel, { passive: true });
        element.addEventListener("touchstart", onInteractionStart, { passive: true });
        element.addEventListener("pointerdown", onInteractionStart, { passive: true });

        return () => {
            element.removeEventListener("wheel", onWheel);
            element.removeEventListener("touchstart", onInteractionStart);
            element.removeEventListener("pointerdown", onInteractionStart);
            clearIdleTimer();
            cancelTailAnimation();
        };
    }, [enabled, tailDurationMs, tailIntensity, idleMs, tailMaxPx]);

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
