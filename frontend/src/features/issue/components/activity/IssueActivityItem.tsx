import { Avatar } from "@shared/ui/Avatar";
import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";
import { TextWithLinks } from "@shared/ui/TextWithLinks";
import { useAuth } from "@shared/providers/AuthContext";

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
}

type Props = { item: UiActivityItem };

export function IssueActivityItem({ item }: Props) {
    const { user } = useAuth();
    const isMe = user?.userId === item.actorId;
    
    // Append (you) to the actor name if it's the current user's action
    const displayTitle = isMe && item.isComment
        ? `${item.actorName} (you)`
        : isMe && !item.isComment
            ? item.title.replace(item.actorName, `${item.actorName} (you)`)
            : item.title;

    return (
        <div className="flex gap-3">
            <Avatar name={item.actorName} size="sm" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white font-semibold">{displayTitle}</p>
                    <span className="text-xs text-neutral-500">{formatDate(item.at)}</span>
                </div>

                <div
                    className={`mt-2 rounded-xl border border-white/10 p-3 ${item.isComment ? "bg-[#1A2234]" : "bg-[#121620]/60"
                        }`}
                >
                    <p className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
                        <TextWithLinks text={item.message} />
                    </p>

                    {item.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {item.attachments.map((a) => (
                                <a
                                    key={a.attachmentId}
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs px-2 py-1 rounded border border-white/15 text-neutral-200 hover:bg-white/5"
                                >
                                    File #{a.attachmentId} ({Math.ceil(a.size / 1024)}kb)
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
