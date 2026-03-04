import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { NotificationItem } from "./NotificationItem";
import { listNotificationsApi, readNotificationApi, deleteNotificationApi, type NotificationItem as NotificationApiItem } from "../../services/api";

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
    const [notifications, setNotifications] = useState<NotificationApiItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const run = async () => {
            setIsLoading(true);
            try {
                const data = await listNotificationsApi();
                setNotifications(data);
            } finally {
                setIsLoading(false);
            }
        };
        run();
    }, [isOpen]);

    const items = useMemo(() => {
        return notifications.map((notification) => ({
            id: notification.notifyUserId,
            title: notification.type.replaceAll("_", " "),
            description:
                notification.issueId != null
                    ? `Issue #${notification.issueId}`
                    : notification.projectId != null
                        ? `Project #${notification.projectId}`
                        : "System notification",
            time: new Date(notification.createdAt).toLocaleString(),
            isRead: notification.isRead,
        }));
    }, [notifications]);

    const onRead = async (notifyUserId: number) => {
        try {
            await readNotificationApi(notifyUserId);
            setNotifications((prev) =>
                prev.map((item) => (item.notifyUserId === notifyUserId ? { ...item, isRead: true } : item)),
            );
        } catch {
            return;
        }
    };

    const onDelete = async (notifyUserId: number) => {
        try {
            await deleteNotificationApi(notifyUserId);
            setNotifications((prev) => prev.filter((item) => item.notifyUserId !== notifyUserId));
        } catch {
            console.error("Failed to delete notification");
        }
    };

    if (!isOpen) return null;

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
                        {isLoading ? <p className="px-2 py-2 text-xs text-neutral-400">Loading...</p> : null}
                        {!isLoading && items.length === 0 ? (
                            <p className="px-2 py-2 text-xs text-neutral-400">No notifications</p>
                        ) : null}
                        {items.map((n) => (
                            <NotificationItem
                                key={n.id}
                                title={n.title}
                                description={n.description}
                                time={n.time}
                                onClick={() => onRead(n.id)}
                                onMarkRead={() => onRead(n.id)}
                                onDelete={() => onDelete(n.id)}
                                unread={!n.isRead}
                            />
                        ))}
                    </div>
                </GlassCard>
            </div>
        </>
    );
}
