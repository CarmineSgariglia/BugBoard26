import { GlassCard } from "./GlassCard";
import { NotificationItem } from "./NotificationItem";

import { notifications } from "./notifyTest"

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
    if (!isOpen) return null;

    // Dummy data matching realistic notifications

    return (
        <>
            {/* Invisible overlay for closing when clicking outside */}
            <div className="fixed inset-0 z-40" onClick={onClose}></div>

            <div className="absolute top-14 right-14 z-50 w-80 origin-top-right">
                <GlassCard className="!p-0 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 font-semibold text-white text-sm border-b border-white/5 shrink-0">
                        Notifications
                    </div>
                    {/* 
                        max-h-[306px] allows exactly 5 items (58px each + 4px gap).
                        mask-image creates the smooth fade effect at the top and bottom.
                    */}
                    <div
                        className="flex flex-col gap-1 p-2 max-h-[306px] overflow-y-auto no-scrollbar"
                        style={{
                            maskImage: 'linear-gradient(to bottom, transparent, black 4%, black 96%, transparent)',
                            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 4%, black 96%, transparent)'
                        }}
                    >
                        {notifications.map(n => (
                            <NotificationItem
                                key={n.id}
                                title={n.title}
                                description={n.description}
                                time={n.time}
                            />
                        ))}
                    </div>
                </GlassCard>
            </div>
        </>
    );
}
