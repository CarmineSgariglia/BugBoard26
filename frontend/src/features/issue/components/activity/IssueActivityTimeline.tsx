import { useEffect, useRef } from "react";
import { ScrollComponent } from "@shared/ui/ScrollComponent";
import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";
import { IssueActivityItem } from "./IssueActivityItem";

type Props = {
    items: UiActivityItem[];
    scrollToItemId?: number | null;
    onScrollToItemDone?: (itemId: number) => void;
};

export function IssueActivityTimeline({ items, scrollToItemId = null, onScrollToItemDone }: Props) {
    const itemsRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (scrollToItemId == null) {
            return;
        }

        const targetElement = itemsRef.current?.querySelector<HTMLElement>(
            `[data-activity-item-id="${scrollToItemId}"]`,
        );

        if (!targetElement) {
            return;
        }

        targetElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });

        onScrollToItemDone?.(scrollToItemId);
    }, [items, onScrollToItemDone, scrollToItemId]);

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
        >
            <div ref={itemsRef} className="space-y-4 p-4">
                {items.map((item) => (
                    <div key={item.id} data-activity-item-id={item.id}>
                        <IssueActivityItem item={item} />
                    </div>
                ))}
            </div>
        </ScrollComponent>
    );
}







