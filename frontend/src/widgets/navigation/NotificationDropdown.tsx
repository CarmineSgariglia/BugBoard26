import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "../ui/GlassCard";
import { NotificationItem } from "./NotificationItem";
import {
    listNotificationsApi,
    readNotificationApi,
    deleteNotificationApi,
} from "../../shared/api/modules/notifications";
import type { NotificationItem as NotificationApiItem } from "../../shared/api/types/notifications";

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
    const queryClient = useQueryClient();

    const {
        data: notifications = [],
        isLoading,
        isFetching,
    } = useQuery({
        queryKey: ["notifications"],
        queryFn: listNotificationsApi,
        enabled: isOpen,
        staleTime: 0,
    });

    const isRefreshing = isFetching && !isLoading;

    const readMutation = useMutation({
        mutationFn: (notifyUserId: number) => readNotificationApi(notifyUserId),
        onMutate: async (notifyUserId) => {
            await queryClient.cancelQueries({ queryKey: ["notifications"] });
            const previous = queryClient.getQueryData<NotificationApiItem[]>(["notifications"]);
            queryClient.setQueryData<NotificationApiItem[]>(["notifications"], (old = []) =>
                old.map((item) =>
                    item.notifyUserId === notifyUserId ? { ...item, isRead: true } : item
                )
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["notifications"], context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (notifyUserId: number) => deleteNotificationApi(notifyUserId),
        onMutate: async (notifyUserId) => {
            await queryClient.cancelQueries({ queryKey: ["notifications"] });
            const previous = queryClient.getQueryData<NotificationApiItem[]>(["notifications"]);
            queryClient.setQueryData<NotificationApiItem[]>(["notifications"], (old = []) =>
                old.filter((item) => item.notifyUserId !== notifyUserId)
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["notifications"], context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

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

    const onRead = (notifyUserId: number) => {
        readMutation.mutate(notifyUserId);
    };

    const onDelete = (notifyUserId: number) => {
        deleteMutation.mutate(notifyUserId);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose}></div>

            <div className="absolute top-full right-0 mt-2 z-50 w-80 origin-top-right">
                <GlassCard className="!p-0 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 font-semibold text-white text-sm border-b border-white/5 shrink-0">
                        Notifications
                    </div>

                    <div
                        className="flex flex-col gap-1 p-2 max-h-[306px] overflow-y-auto no-scrollbar"
                        style={{
                            maskImage: "linear-gradient(to bottom, transparent, black 4%, black 96%, transparent)",
                            WebkitMaskImage:
                                "linear-gradient(to bottom, transparent, black 4%, black 96%, transparent)",
                        }}
                    >
                        {isLoading ? <p className="px-2 py-2 text-xs text-neutral-400">Loading...</p> : null}
                        {isRefreshing ? <p className="px-2 py-2 text-xs text-neutral-500">Refreshing...</p> : null}
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
