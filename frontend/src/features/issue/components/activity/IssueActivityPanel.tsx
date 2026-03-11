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

export function IssueActivityPanel({ issueId, currentUser, canCompose, className = "h-full" }: Props) {
    const qc = useQueryClient();
    const [scope, setScope] = useState<"ALL" | "YOURS">("ALL");
    const [sort, setSort] = useState<"NEWEST" | "OLDEST">("OLDEST");
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);

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

            if (!files.length) {
                await createIssueUpdateApi(issueId, { message: text });
                return;
            }

            // Backend currently supports one file per request; submit one request per file.
            for (const file of files) {
                await createIssueUpdateApi(issueId, { message: text, file });
            }
        },
        onSuccess: async () => {
            setMessage("");
            setFiles([]);
            await qc.invalidateQueries({ queryKey: ["issue", issueId, "updates"] });
        },
    });

    const items = useMemo(() => {
        const mapped = updates.map(formatIssueActivityEvent);

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
                <IssueActivityComposer
                    message={message}
                    onMessageChange={setMessage}
                    files={files}
                    onFilesChange={setFiles}
                    onSubmit={() => sendMutation.mutate()}
                    isSubmitting={sendMutation.isPending}
                />
            ) : null}
        </div>
    );
}