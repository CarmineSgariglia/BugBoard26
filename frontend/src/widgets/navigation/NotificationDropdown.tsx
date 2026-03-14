import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../../shared/ui/GlassCard";
import { NotificationItem } from "./NotificationItem";
import {
    listNotificationsApi,
    readNotificationApi,
    deleteNotificationApi,
} from "../../shared/api/modules/notifications";
import { getIssueApi } from "../../shared/api/modules/issues";
import type { NotificationItem as NotificationApiItem } from "../../shared/api/types/notifications";
import {
    getNotificationDescription,
    getNotificationIcon,
    getNotificationTitle,
} from "../../shared/lib/notifications";

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

type NotificationListItem = {
    id: number;
    type: string;
    issueId: number | null;
    projectId: number | null;
    targetKind: "issue" | "project" | "none";
    title: string;
    description: string;
    time: string;
    isRead: boolean;
};

// Notification target kind
type NotificationTargetKind = "issue" | "project" | "none";

function getNotificationTargetKind(type: string): NotificationTargetKind {
    if (type.startsWith("ISSUE_")) return "issue";
    if (type === "PROJECT_ADDED") return "project";
    if (type === "PROJECT_UNASSIGNED" || type === "PROJECT_REMOVED") return "none";
    return "none";
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [pendingNotificationId, setPendingNotificationId] = useState<number | null>(null);
    const [navError, setNavError] = useState<string | null>(null);

    const {
        data: notifications = [],
        isLoading,
    } = useQuery({
        queryKey: ["notifications"],
        queryFn: listNotificationsApi,
        enabled: isOpen,
        staleTime: 0,
    });

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
                        className="flex flex-col gap-1 p-2 max-h-[306px] overflow-y-auto no-scrollbar"
                        style={{
                            maskImage: "linear-gradient(to bottom, transparent, black 4%, black 96%, transparent)",
                            WebkitMaskImage:
                                "linear-gradient(to bottom, transparent, black 4%, black 96%, transparent)",
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
                                icon={getNotificationIcon(n.type as any)}
                                onClick={() => {
                                    if (pendingNotificationId === n.id) return;
                                    void onNotificationClick(n);
                                }}
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
