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

function formatActorDisplayNameFromEvent(event: Pick<
    IssueUpdate,
    "actorUsername" | "actorFirstName" | "actorLastName"
>): string {
    const fullName = `${event.actorFirstName ?? ""} ${event.actorLastName ?? ""}`.trim();
    return fullName ? `${fullName} (${event.actorUsername})` : event.actorUsername;
}

export function formatIssueActivityEvent(
    event: IssueUpdate,
    actorDisplayName?: string,
): UiActivityItem {
    const type = event.eventType;
    const actorName = actorDisplayName ?? formatActorDisplayNameFromEvent(event);

    if (type === "COMMENT") {
        return {
            id: event.updateId,
            actorId: event.actorId,
            actorName,
            actorProfileImg: event.actorProfileImg ?? null,
            at: event.at,
            eventType: type,
            title: actorName,
            message: event.message,
            isComment: true,
            attachments: event.attachments ?? [],
        };
    }

    let title = `${actorName} updated the issue`;
    if (type === "ASSIGN") title = `${actorName} added member(s)`;
    if (type === "UNASSIGN") title = `${actorName} removed member(s)`;
    if (type === "STATUS_CHANGE") title = `${actorName} changed status`;
    if (type === "CREATE") title = `${actorName} created the issue`;

    return {
        id: event.updateId,
        actorId: event.actorId,
        actorName,
        actorProfileImg: event.actorProfileImg ?? null,
        at: event.at,
        eventType: type,
        title,
        message: event.message || "Issue updated",
        isComment: false,
        attachments: event.attachments ?? [],
    };
}
