/* ADAPTER */

import type { IssueUpdate } from "@shared/api/types/issues";

export type UiActivityItem = {
    id: number;
    actorId: number;
    actorName: string;
    actorProfileImg: string | null;
    at: string;
    eventType: string;
    title: string;
    message: string;
    isComment: boolean;
    attachments: IssueUpdate["attachments"];
};

export function formatIssueActivityEvent(event: IssueUpdate): UiActivityItem {
    const type = event.eventType;

    if (type === "COMMENT") {
        return {
            id: event.updateId,
            actorId: event.actorId,
            actorName: event.actorUsername,
            actorProfileImg: event.actorProfileImg ?? null,
            at: event.at,
            eventType: type,
            title: event.actorUsername,
            message: event.message,
            isComment: true,
            attachments: event.attachments ?? [],
        };
    }

    let title = `${event.actorUsername} updated the issue`;
    if (type === "ASSIGN") title = `${event.actorUsername} added member(s)`;
    if (type === "UNASSIGN") title = `${event.actorUsername} removed member(s)`;
    if (type === "STATUS_CHANGE") title = `${event.actorUsername} changed status`;
    if (type === "CREATE") title = `${event.actorUsername} created the issue`;

    return {
        id: event.updateId,
        actorId: event.actorId,
        actorName: event.actorUsername,
        actorProfileImg: event.actorProfileImg ?? null,
        at: event.at,
        eventType: type,
        title,
        message: event.message || "Issue updated",
        isComment: false,
        attachments: event.attachments ?? [],
    };
}
