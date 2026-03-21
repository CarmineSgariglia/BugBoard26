import { useMemo, useState, type UIEvent } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { NotificationItem } from "./NotificationItem";
import {
  deleteNotificationApi,
  listNotificationsApi,
  notificationsPageSize,
  notificationsQueryKey,
  readNotificationApi,
} from "@features/notification/api";
import { getIssueApi } from "@features/issue/api";
import type {
  NotificationType,
  NotificationsPage,
} from "@shared/api/types/notifications";
import {
  flattenNotificationsPages,
  getNotificationDescription,
  getNotificationIcon,
  getNotificationTargetKind,
  getNotificationTitle,
  updateNotificationsInfiniteData,
} from "@features/notification/lib/notifications";
import { GlassCard } from "@shared/ui/GlassCard";
import { ScrollComponent } from "@shared/ui/ScrollComponent";

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

type NotificationListItem = {
    id: number;
    type: NotificationType;
    issueId: number | null;
    projectId: number | null;
    targetKind: "issue" | "project" | "none";
    title: string;
    description: string;
    time: string;
    isRead: boolean;
};

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [pendingNotificationId, setPendingNotificationId] = useState<number | null>(null);
    const [navError, setNavError] = useState<string | null>(null);

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useInfiniteQuery({
        queryKey: notificationsQueryKey,
        queryFn: ({ pageParam, signal }) =>
            listNotificationsApi({ limit: notificationsPageSize, before: pageParam }, { signal }),
        initialPageParam: null as number | null,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
        enabled: isOpen,
        staleTime: 0,
    });

    const notifications = useMemo(() => flattenNotificationsPages(data), [data]);

    const readMutation = useMutation({
        mutationFn: (notifyUserId: number) => readNotificationApi(notifyUserId),
        onMutate: async (notifyUserId) => {
            await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
            const previous = queryClient.getQueryData<InfiniteData<NotificationsPage>>(notificationsQueryKey);
            queryClient.setQueryData(
                notificationsQueryKey,
                (old: InfiniteData<NotificationsPage> | undefined) =>
                    updateNotificationsInfiniteData(old, (item) =>
                        item.notifyUserId === notifyUserId ? { ...item, isRead: true } : item
                    )
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(notificationsQueryKey, context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (notifyUserId: number) => deleteNotificationApi(notifyUserId),
        onMutate: async (notifyUserId) => {
            await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
            const previous = queryClient.getQueryData<InfiniteData<NotificationsPage>>(notificationsQueryKey);
            queryClient.setQueryData(
                notificationsQueryKey,
                (old: InfiniteData<NotificationsPage> | undefined) =>
                    updateNotificationsInfiniteData(old, (item) =>
                        item.notifyUserId === notifyUserId ? null : item
                    )
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(notificationsQueryKey, context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        },
    });

    const items = useMemo<NotificationListItem[]>(() => {
        return notifications.map((notification) => ({
            id: notification.notifyUserId,
            type: notification.type,
            issueId: notification.issueId ?? null,
            projectId: notification.projectId ?? null,
            targetKind: getNotificationTargetKind(notification.type),
            title: getNotificationTitle(notification.type),
            description: getNotificationDescription(notification),
            time: new Date(notification.createdAt).toLocaleString(),
            isRead: notification.isRead,
        }));
    }, [notifications]);

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        if (!hasNextPage || isFetchingNextPage) {
            return;
        }

        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollHeight - scrollTop - clientHeight <= 48) {
            void fetchNextPage();
        }
    };


    const onRead = (notifyUserId: number) => {
        readMutation.mutate(notifyUserId);
    };

    const onDelete = (notifyUserId: number) => {
        deleteMutation.mutate(notifyUserId);
    };

    async function resolveNotificationRoute(item: NotificationListItem): Promise<string | null> {
        if (item.targetKind === "none") return null;

        if (item.targetKind === "project") {
            if (item.projectId == null) return null;
            return `/projects/${item.projectId}/issues`;
        }

        if (item.issueId == null) return null;

        if (item.projectId != null) {
            return `/projects/${item.projectId}/issues/${item.issueId}`;
        }

        try {
            const issue = await getIssueApi(item.issueId);
            if (issue.projectId == null) return null;
            return `/projects/${issue.projectId}/issues/${item.issueId}`;
        } catch {
            return null;
        }
    }

    const onNotificationClick = async (item: NotificationListItem) => {
        if (pendingNotificationId !== null) return;

        setNavError(null);
        setPendingNotificationId(item.id);

        try {
            // Sempre mark-as-read al click, anche se la navigazione fallisce.
            onRead(item.id);

            const route = await resolveNotificationRoute(item);
            if (!route) {
                setNavError("Target non disponibile.");
                return;
            }

            onClose();
            navigate(route);
        } finally {
            setPendingNotificationId(null);
        }
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
                    {navError ? (
                        <div className="px-4 py-2 text-xs text-amber-300 bg-amber-500/10 border-b border-amber-400/20">
                            {navError}
                        </div>
                    ) : null}

                    <div
                        className="min-h-0"
                        style={{
                            maskImage: "linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)",
                            WebkitMaskImage:
                                "linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)",
                        }}
                    >
                        <ScrollComponent
                            hideBorder
                            wheelOptions={{ tailDurationMs: 760, tailIntensity: 0.2, tailMaxPx: 90, idleMs: 100 }}
                            maxHeight="max-h-[306px]"
                            className="min-h-0 !p-2 no-scrollbar"
                            onScroll={handleScroll}
                            testId="notification-scroll-panel"
                        >
                            <div
                                className="flex flex-col gap-1 pt-2 pb-2"
                                data-testid="notification-scroll-container"
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
                                        icon={getNotificationIcon(n.type)}
                                        onClick={() => {
                                            if (pendingNotificationId === n.id) return;
                                            void onNotificationClick(n);
                                        }}
                                        onMarkRead={() => onRead(n.id)}
                                        onDelete={() => onDelete(n.id)}
                                        unread={!n.isRead}
                                    />
                                ))}
                                {isFetchingNextPage ? (
                                    <p className="px-2 py-2 text-xs text-neutral-500">Loading more...</p>
                                ) : null}
                            </div>
                        </ScrollComponent>
                    </div>
                </GlassCard>
            </div>
        </>
    );
}
