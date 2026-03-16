import {
    FiFolderPlus,
    FiFolderMinus,
    FiUserX,
    FiUserCheck,
    FiCheckCircle,
    FiFilePlus,
    FiRefreshCw,
    FiBell
} from "react-icons/fi";
import type { InfiniteData } from "@tanstack/react-query";
import type { NotificationItem, NotificationType, NotificationsPage } from "../../shared/api/types/notifications";

export type NotificationTargetKind = "issue" | "project" | "none";

export function getNotificationTargetKind(type: NotificationType): NotificationTargetKind {
    if (type.startsWith("ISSUE_")) return "issue";
    if (type === "PROJECT_ADDED") return "project";
    if (type === "PROJECT_UNASSIGNED" || type === "UNASSIGNED_PROJECT" || type === "PROJECT_REMOVED") {
        return "none";
    }
    return "none";
}

export function getNotificationIcon(type: NotificationType) {
    switch (type) {
        case "PROJECT_ADDED":
            return <FiFolderPlus size={18} className="text-emerald-400" />;
        case "PROJECT_REMOVED":
            return <FiFolderMinus size={18} className="text-rose-400" />;
        case "PROJECT_UNASSIGNED":
        case "ISSUE_UNASSIGNED":
            return <FiUserX size={18} className="text-orange-400" />;
        case "ISSUE_ASSIGNED":
            return <FiUserCheck size={18} className="text-cyan-400" />;
        case "ISSUE_ADDED":
            return <FiFilePlus size={18} className="text-indigo-400" />;
        case "ISSUE_CLOSED":
            return <FiCheckCircle size={18} className="text-emerald-400" />;
        case "ISSUE_UPDATED":
            return <FiRefreshCw size={18} className="text-blue-400" />;
        default:
            return <FiBell size={18} className="text-neutral-400" />;
    }
}

export function getNotificationTitle(type: NotificationType): string {
    switch (type) {
        case "PROJECT_ADDED":
            return "Project added";
        case "PROJECT_REMOVED":
            return "Project removed";
        case "PROJECT_UNASSIGNED":
            return "Project unassigned";
        case "ISSUE_ASSIGNED":
            return "Issue assigned";
        case "ISSUE_ADDED":
            return "Issue created";
        case "ISSUE_CLOSED":
            return "Issue closed";
        case "ISSUE_UNASSIGNED":
            return "Issue unassigned";
        case "ISSUE_UPDATED":
            return "Issue updated";
        default:
            return type.replaceAll("_", " ");
    }
}

export function getNotificationDescription(notification: Pick<NotificationItem, "issueId" | "projectId">): string {
    if (notification.issueId != null) {
        return `Issue #${notification.issueId}`;
    }
    if (notification.projectId != null) {
        return `Project #${notification.projectId}`;
    }
    return "System notification";
}

export function flattenNotificationsPages(data?: InfiniteData<NotificationsPage> | null): NotificationItem[] {
    return data?.pages.flatMap((page) => page.results) ?? [];
}

export function getNotificationsHasUnread(data?: InfiniteData<NotificationsPage> | null): boolean {
    return data?.pages[0]?.hasUnread ?? false;
}

export function updateNotificationsInfiniteData(
    data: InfiniteData<NotificationsPage> | undefined,
    updater: (notification: NotificationItem) => NotificationItem | null,
): InfiniteData<NotificationsPage> | undefined {
    if (!data) return data;

    const pages = data.pages.map((page) => ({
        ...page,
        results: page.results.flatMap((notification) => {
            const nextNotification = updater(notification);
            return nextNotification ? [nextNotification] : [];
        }),
    }));
    const hasLoadedUnread = pages.some((page) =>
        page.results.some((notification) => !notification.isRead),
    );
    const isFullyLoaded = pages.length > 0 && pages[pages.length - 1]?.hasMore === false;
    const hasUnread = hasLoadedUnread || (!isFullyLoaded && (data.pages[0]?.hasUnread ?? false));

    return {
        ...data,
        pages: pages.map((page) => ({
            ...page,
            hasUnread,
        })),
    };
}

export function prependNotificationToInfiniteData(
    data: InfiniteData<NotificationsPage> | undefined,
    notification: NotificationItem,
): InfiniteData<NotificationsPage> {
    if (!data || data.pages.length === 0) {
        return {
            pageParams: [null],
            pages: [
                {
                    results: [notification],
                    nextCursor: null,
                    hasMore: false,
                    hasUnread: !notification.isRead,
                },
            ],
        };
    }

    const hasUnread = data.pages.some((page) => page.hasUnread) || !notification.isRead;

    return {
        ...data,
        pages: data.pages.map((page, index) => {
            const filteredResults = page.results.filter(
                (item) => item.notifyUserId !== notification.notifyUserId,
            );

            if (index === 0) {
                return {
                    ...page,
                    results: [notification, ...filteredResults],
                    hasUnread,
                };
            }

            return {
                ...page,
                results: filteredResults,
                hasUnread,
            };
        }),
    };
}
