import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createIssueUpdateApi, listIssueUpdatesApi } from "@features/issue/api";
import type { AuthUser } from "@shared/api/types/auth";
import type { IssueUpdate } from "@shared/api/types/issues";
import type { ProjectMembership } from "@shared/api/types/projects";
import { InfoBanner } from "@shared/ui";
import { getLatestIssueUpdateId, upsertIssueUpdates } from "@features/issue/lib/issueUpdatesRealtime";
import { formatIssueActivityEvent } from "@features/issue/lib/formatIssueActivityEvent";
import { IssueActivityFilters } from "./IssueActivityFilters";
import { IssueActivityRealtimeListener } from "./IssueActivityRealtimeListener";
import { IssueActivityTimeline } from "./IssueActivityTimeline";
import { IssueActivityComposer } from "./IssueActivityComposer";

type Props = {
    issueId: number;
    issueTitle: string;
    currentUser: AuthUser | null;
    projectMembers?: ProjectMembership[];
    canCompose: boolean;
    composeUnavailableMessage?: string | null;
    className?: string;
};

const NEW_MESSAGE_MARKER_VISIBLE_MS = 3000;

function getSubmitErrorMessage(error: unknown): string {
    if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object" &&
        (error as { response?: unknown }).response !== null
    ) {
        const response = (error as { response: { data?: unknown } }).response;
        const data = response.data;

        if (typeof data === "string" && data.trim()) {
            return data;
        }

        if (typeof data === "object" && data !== null) {
            if ("message" in data) {
                const messageField = (data as { message?: unknown }).message;
                if (typeof messageField === "string" && messageField.trim()) {
                    return messageField;
                }
                if (
                    Array.isArray(messageField) &&
                    messageField.length > 0 &&
                    typeof messageField[0] === "string" &&
                    messageField[0].trim()
                ) {
                    return messageField[0];
                }
            }
            if ("file" in data && typeof (data as { file?: unknown }).file === "string") {
                return (data as { file: string }).file;
            }
            if ("detail" in data && typeof (data as { detail?: unknown }).detail === "string") {
                return (data as { detail: string }).detail;
            }
        }
    }

    return "File non valido o non supportato.";
}

function formatActorDisplayName(member: {
    username: string;
    firstName?: string;
    lastName?: string;
}): string {
    const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
    return fullName ? `${fullName} (${member.username})` : member.username;
}

export function IssueActivityPanel({
    issueId,
    issueTitle,
    currentUser,
    projectMembers = [],
    canCompose,
    composeUnavailableMessage = null,
    className = "h-full",
}: Props) {
    const qc = useQueryClient();
    const [scope, setScope] = useState<"ALL" | "YOURS">("ALL");
    const [sort, setSort] = useState<"NEWEST" | "OLDEST">("OLDEST");
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [scrollToItemId, setScrollToItemId] = useState<number | null>(null);
    const [pendingUpdateIds, setPendingUpdateIds] = useState<number[]>([]);
    const [newMessageMarkerId, setNewMessageMarkerId] = useState<number | null>(null);
    const [isAtLatestEdge, setIsAtLatestEdge] = useState(false);
    const markerVisibleSinceRef = useRef<number | null>(null);
    const markerVisibleAccumulatedMsRef = useRef(0);
    const markerRemovalTimerRef = useRef<number | null>(null);

    const { data: updates = [], isLoading, isSuccess } = useQuery({
        queryKey: ["issue", issueId, "updates"],
        queryFn: ({ signal }) => listIssueUpdatesApi(issueId, { signal }),
        staleTime: 0,
        enabled: Boolean(issueId),
    });

    const sendMutation = useMutation({
        mutationFn: async () => {
            const text = message.trim();
            if (!text) throw new Error("Message required");

            const newUpdate = await createIssueUpdateApi(issueId, { message: text, files });
            return newUpdate;
        },
        onMutate: () => {
            setSubmitError(null);
        },
        onSuccess: (newUpdate) => {
            setMessage("");
            setFiles([]);
            setScrollToItemId(newUpdate.updateId);

            qc.setQueryData<IssueUpdate[]>(["issue", issueId, "updates"], (oldData = []) =>
                upsertIssueUpdates(oldData, newUpdate)
            );
        },
        onError: (error) => {
            setSubmitError(getSubmitErrorMessage(error));
        },
    });

    const items = useMemo(() => {
        const actorDisplayNameById = new Map(
            projectMembers.map((member) => [member.userId, formatActorDisplayName(member)]),
        );

        const mapped = updates
            .filter((update) => update.eventType !== "CREATE")
            .map((update) => formatIssueActivityEvent(update, actorDisplayNameById.get(update.actorId)));

        const filtered =
            scope === "YOURS" && currentUser
                ? mapped.filter((item) => item.actorId === currentUser.userId)
                : mapped;

        return filtered.sort((a, b) => {
            const aTime = new Date(a.at).getTime();
            const bTime = new Date(b.at).getTime();
            return sort === "NEWEST" ? bTime - aTime : aTime - bTime;
        });
    }, [updates, scope, sort, currentUser, projectMembers]);

    const latestUpdateId = useMemo(() => getLatestIssueUpdateId(updates), [updates]);

    const clearMarkerRemovalTimer = useCallback(() => {
        if (markerRemovalTimerRef.current != null) {
            window.clearTimeout(markerRemovalTimerRef.current);
            markerRemovalTimerRef.current = null;
        }
    }, []);

    const resetMarkerVisibilityTracking = useCallback(() => {
        clearMarkerRemovalTimer();
        markerVisibleSinceRef.current = null;
        markerVisibleAccumulatedMsRef.current = 0;
    }, [clearMarkerRemovalTimer]);

    useEffect(() => {
        resetMarkerVisibilityTracking();

        return () => {
            clearMarkerRemovalTimer();
        };
    }, [clearMarkerRemovalTimer, newMessageMarkerId, resetMarkerVisibilityTracking]);

    function handleRealtimeUpdate(newUpdate: IssueUpdate) {
        let alreadyPresent = false;

        qc.setQueryData<IssueUpdate[]>(["issue", issueId, "updates"], (oldData = []) => {
            alreadyPresent = oldData.some((existingUpdate) => existingUpdate.updateId === newUpdate.updateId);
            return upsertIssueUpdates(oldData, newUpdate);
        });

        if (alreadyPresent) {
            return;
        }

        if (currentUser?.userId === newUpdate.actorId) {
            setScrollToItemId(newUpdate.updateId);
            return;
        }

        setNewMessageMarkerId((current) => current ?? newUpdate.updateId);

        const isVisibleInCurrentScope =
            scope === "ALL" || (scope === "YOURS" && currentUser?.userId === newUpdate.actorId);

        if (scope === "ALL" && isAtLatestEdge && isVisibleInCurrentScope) {
            setScrollToItemId(newUpdate.updateId);
            return;
        }

        setPendingUpdateIds((current) =>
            current.includes(newUpdate.updateId) ? current : [...current, newUpdate.updateId],
        );
    }

    function handleBadgeClick() {
        if (pendingUpdateIds.length === 0) {
            return;
        }

        const firstPendingUpdateId = pendingUpdateIds[0];
        if (scope === "YOURS") {
            setScope("ALL");
        }
        setScrollToItemId(firstPendingUpdateId);
        setPendingUpdateIds([]);
    }

    const handleNewMessageMarkerVisibilityChange = useCallback((isVisible: boolean) => {
        if (newMessageMarkerId == null) {
            resetMarkerVisibilityTracking();
            return;
        }

        const now = Date.now();

        if (isVisible) {
            if (markerVisibleSinceRef.current != null) {
                return;
            }

            markerVisibleSinceRef.current = now;
            clearMarkerRemovalTimer();

            const remainingMs = Math.max(
                0,
                NEW_MESSAGE_MARKER_VISIBLE_MS - markerVisibleAccumulatedMsRef.current,
            );

            markerRemovalTimerRef.current = window.setTimeout(() => {
                markerVisibleAccumulatedMsRef.current = NEW_MESSAGE_MARKER_VISIBLE_MS;
                markerVisibleSinceRef.current = null;
                markerRemovalTimerRef.current = null;
                setNewMessageMarkerId((current) => (current === newMessageMarkerId ? null : current));
            }, remainingMs);

            return;
        }

        if (markerVisibleSinceRef.current == null) {
            clearMarkerRemovalTimer();
            return;
        }

        markerVisibleAccumulatedMsRef.current += now - markerVisibleSinceRef.current;
        markerVisibleSinceRef.current = null;
        clearMarkerRemovalTimer();

        if (markerVisibleAccumulatedMsRef.current >= NEW_MESSAGE_MARKER_VISIBLE_MS) {
            setNewMessageMarkerId((current) => (current === newMessageMarkerId ? null : current));
        }
    }, [newMessageMarkerId, resetMarkerVisibilityTracking, clearMarkerRemovalTimer]);

    return (
        <div className={`rounded-2xl border border-white/5 bg-[#121620]/20 flex flex-col overflow-hidden ${className}`}>
            {isSuccess ? (
                <IssueActivityRealtimeListener
                    issueId={issueId}
                    latestUpdateId={latestUpdateId}
                    onUpdate={handleRealtimeUpdate}
                />
            ) : null}
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-white">{`${issueTitle} - Activity`}</h3>
                <IssueActivityFilters
                    scope={scope}
                    sort={sort}
                    onScopeChange={setScope}
                    onSortChange={setSort}
                />
            </div>

            <div className="relative flex-1 min-h-0">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center text-neutral-500">Loading activity...</div>
                ) : (
                    <IssueActivityTimeline
                        items={items}
                        sort={sort}
                        scrollToItemId={scrollToItemId}
                        newMessageMarkerId={newMessageMarkerId}
                        onScrollToItemDone={(itemId) => {
                            setScrollToItemId((current) => (current === itemId ? null : current));
                        }}
                        onLatestEdgeChange={(nextIsAtLatestEdge) => {
                            setIsAtLatestEdge(nextIsAtLatestEdge);
                            if (scope === "ALL" && nextIsAtLatestEdge && pendingUpdateIds.length > 0) {
                                setPendingUpdateIds([]);
                            }
                        }}
                        onNewMessageMarkerVisibilityChange={handleNewMessageMarkerVisibilityChange}
                    />
                )}

                {!isLoading && pendingUpdateIds.length > 0 ? (
                    <div
                        className={`pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 ${sort === "NEWEST" ? "top-4" : "bottom-4"
                            }`}
                    >
                        <button
                            type="button"
                            onClick={handleBadgeClick}
                            className="pointer-events-auto inline-flex items-center rounded-full border border-sky-400/35 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 shadow-[0_10px_35px_rgba(14,165,233,0.18)] transition hover:bg-sky-500/30"
                        >
                            {`New message: ${pendingUpdateIds.length}`}
                        </button>
                    </div>
                ) : null}
            </div>

            {canCompose ? (
                <>
                    {submitError ? (
                        <div className="px-3 py-2 text-xs text-rose-300 bg-rose-500/10 border-t border-rose-500/20">
                            {submitError}
                        </div>
                    ) : null}
                    <IssueActivityComposer
                        message={message}
                        onMessageChange={setMessage}
                        files={files}
                        onFilesChange={setFiles}
                        onSubmit={() => sendMutation.mutate()}
                        isSubmitting={sendMutation.isPending}
                    />
                </>
            ) : composeUnavailableMessage ? (
                <InfoBanner message={composeUnavailableMessage} />
            ) : null}
        </div>
    );
}
