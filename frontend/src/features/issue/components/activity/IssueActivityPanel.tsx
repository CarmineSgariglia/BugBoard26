import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createIssueUpdateApi, listIssueUpdatesApi } from "@shared/api/modules/issues";
import type { AuthUser } from "@shared/api/types/auth";
import { formatIssueActivityEvent } from "@features/issue/lib/formatIssueActivityEvent";
import { IssueActivityFilters } from "./IssueActivityFilters";
import { IssueActivityTimeline } from "./IssueActivityTimeline";
import { IssueActivityComposer } from "./IssueActivityComposer";

type Props = {
    issueId: number;
    currentUser: AuthUser | null;
    canCompose: boolean;
    className?: string;
};

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

export function IssueActivityPanel({ issueId, currentUser, canCompose, className = "h-full" }: Props) {
    const qc = useQueryClient();
    const [scope, setScope] = useState<"ALL" | "YOURS">("ALL");
    const [sort, setSort] = useState<"NEWEST" | "OLDEST">("OLDEST");
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const { data: updates = [], isLoading } = useQuery({
        queryKey: ["issue", issueId, "updates"],
        queryFn: () => listIssueUpdatesApi(issueId),
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

            // Aggiornamento ottimistico: appendiamo l'entità appena creata alla fine dell'array corrente.
            qc.setQueryData(["issue", issueId, "updates"], (oldData: any) => {
                if (!oldData) return [newUpdate];
                return [...oldData, newUpdate];
            });
        },
        onError: (error) => {
            setSubmitError(getSubmitErrorMessage(error));
        },
    });

    const items = useMemo(() => {
        const mapped = updates
            .filter((update) => update.eventType !== "CREATE")
            .map(formatIssueActivityEvent);

        const filtered =
            scope === "YOURS" && currentUser
                ? mapped.filter((item) => item.actorId === currentUser.userId)
                : mapped;

        return filtered.sort((a, b) => {
            const aTime = new Date(a.at).getTime();
            const bTime = new Date(b.at).getTime();
            return sort === "NEWEST" ? bTime - aTime : aTime - bTime;
        });
    }, [updates, scope, sort, currentUser]);

    return (
        <div className={`rounded-2xl border border-white/5 bg-[#121620]/20 flex flex-col overflow-hidden ${className}`}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-white">Activity</h3>
                <IssueActivityFilters
                    scope={scope}
                    sort={sort}
                    onScopeChange={setScope}
                    onSortChange={setSort}
                />
            </div>

            <div className="flex-1 min-h-0">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center text-neutral-500">Loading activity...</div>
                ) : (
                    <IssueActivityTimeline items={items} />
                )}
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
            ) : null}
        </div>
    );
}
