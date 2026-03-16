import { useEffect, useRef, type UIEvent } from "react";
import { ScrollComponent } from "@shared/ui/ScrollComponent";
import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";
import { IssueActivityItem } from "./IssueActivityItem";

const LATEST_EDGE_THRESHOLD_PX = 48;

type Props = {
    items: UiActivityItem[];
    sort: "NEWEST" | "OLDEST";
    scrollToItemId?: number | null;
    newMessageMarkerId?: number | null;
    onScrollToItemDone?: (itemId: number) => void;
    onLatestEdgeChange?: (isAtLatestEdge: boolean) => void;
    onNewMessageMarkerVisibilityChange?: (isVisible: boolean) => void;
};

function isAtLatestEdge(element: HTMLDivElement, sort: "NEWEST" | "OLDEST") {
    if (sort === "NEWEST") {
        return element.scrollTop <= LATEST_EDGE_THRESHOLD_PX;
    }

    return element.scrollHeight - element.scrollTop - element.clientHeight <= LATEST_EDGE_THRESHOLD_PX;
}

export function IssueActivityTimeline({
    items,
    sort,
    scrollToItemId = null,
    newMessageMarkerId = null,
    onScrollToItemDone,
    onLatestEdgeChange,
    onNewMessageMarkerVisibilityChange,
}: Props) {
    const itemsRef = useRef<HTMLDivElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const newMessageMarkerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (scrollToItemId == null) {
            return;
        }

        const targetElement =
            itemsRef.current?.querySelector<HTMLElement>(`[data-activity-marker-id="${scrollToItemId}"]`) ??
            itemsRef.current?.querySelector<HTMLElement>(`[data-activity-item-id="${scrollToItemId}"]`);

        if (!targetElement) {
            return;
        }

        const isMarker = targetElement.hasAttribute('data-activity-marker-id');

        targetElement.scrollIntoView({
            behavior: "smooth",
            block: isMarker ? "start" : "nearest",
        });

        onScrollToItemDone?.(scrollToItemId);
    }, [items, onScrollToItemDone, scrollToItemId]);

    useEffect(() => {
        const element = scrollContainerRef.current;
        if (!element) {
            return;
        }

        const animationFrame = window.requestAnimationFrame(() => {
            onLatestEdgeChange?.(isAtLatestEdge(element, sort));
        });

        return () => {
            window.cancelAnimationFrame(animationFrame);
        };
    }, [items, onLatestEdgeChange, sort]);

    useEffect(() => {
        if (!onNewMessageMarkerVisibilityChange) {
            return;
        }

        const root = scrollContainerRef.current;
        const markerElement = newMessageMarkerRef.current;
        const hasMarkerItem = newMessageMarkerId != null && items.some((item) => item.id === newMessageMarkerId);

        if (!root || !markerElement || !hasMarkerItem) {
            onNewMessageMarkerVisibilityChange(false);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                onNewMessageMarkerVisibilityChange(Boolean(entry?.isIntersecting));
            },
            {
                root,
                threshold: 0.01,
            },
        );

        observer.observe(markerElement);

        return () => {
            observer.disconnect();
            onNewMessageMarkerVisibilityChange(false);
        };
    }, [items, newMessageMarkerId, onNewMessageMarkerVisibilityChange]);

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        onLatestEdgeChange?.(isAtLatestEdge(event.currentTarget, sort));
    };

    if (!items.length) {
        return (
            <div className="h-full rounded-xl border border-white/5 bg-[#121620]/30 flex items-center justify-center">
                <p className="text-sm text-neutral-500 italic">No activity for selected filters.</p>
            </div>
        );
    }

    return (
        <ScrollComponent
            hideBorder
            smooth
            wheelOptions={{ tailDurationMs: 760, tailIntensity: 0.2, tailMaxPx: 90, idleMs: 100 }}
            maxHeight="max-h-none"
            className="h-full p-0"
            containerRef={scrollContainerRef}
            onScroll={handleScroll}
            testId="issue-activity-scroll-panel"
        >
            <div ref={itemsRef} className="space-y-4 p-4">
                {items.map((item) => (
                    <div key={item.id} data-activity-entry-id={item.id}>
                        <div data-activity-item-id={item.id}>
                            <IssueActivityItem
                                ref={item.id === newMessageMarkerId ? newMessageMarkerRef : undefined}
                                item={item}
                                showNewMessageMarker={item.id === newMessageMarkerId}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </ScrollComponent>
    );
}







