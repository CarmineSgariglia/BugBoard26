import { ScrollComponent } from "@shared/ui/ScrollComponent";
import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";
import { IssueActivityItem } from "./IssueActivityItem";

type Props = { items: UiActivityItem[] };

export function IssueActivityTimeline({ items }: Props) {
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
            <div className="space-y-4 p-4">
                {items.map((item) => (
                    <IssueActivityItem key={item.id} item={item} />
                ))}
            </div>
        </ScrollComponent>
    );
}







