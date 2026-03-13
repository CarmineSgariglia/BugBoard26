import { useMemo, useState } from "react";
import { FiDownload, FiEye, FiFile } from "react-icons/fi";

import { Avatar } from "@shared/ui/Avatar";
import { resolveMediaUrl } from "@shared/api/core/media";
import type { IssueAttachment } from "@shared/api/types/issues";
import type { UiActivityItem } from "@features/issue/lib/formatIssueActivityEvent";
import { TextWithLinks } from "@shared/ui/TextWithLinks";
import {
    formatBytes,
    getAttachmentDisplayName,
    isAttachmentPreviewable,
} from "@shared/lib/media";
import { useAuth } from "@shared/providers/AuthContext";
import { IssueAttachmentPreviewModal } from "./IssueAttachmentPreviewModal";

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
}

type Props = { item: UiActivityItem };

type AttachmentActionProps = {
    attachment: IssueAttachment;
    onPreview: (attachment: IssueAttachment) => void;
};

function AttachmentActions({ attachment, onPreview }: AttachmentActionProps) {
    const resolvedUrl = useMemo(
        () => resolveMediaUrl(attachment.url || attachment.path),
        [attachment.path, attachment.url],
    );
    const displayName = useMemo(() => getAttachmentDisplayName(attachment), [attachment]);
    const canPreview = useMemo(() => isAttachmentPreviewable(attachment), [attachment]);

    return (
        <div className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-white/10 bg-[#101826] px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-neutral-300">
                <FiFile size={16} />
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
                <p className="text-xs text-neutral-400">{formatBytes(attachment.size)}</p>
            </div>

            <div className="flex items-center gap-1">
                {canPreview ? (
                    <button
                        type="button"
                        onClick={() => onPreview(attachment)}
                        className="rounded-lg border border-white/10 p-2 text-neutral-300 transition hover:bg-white/5 hover:text-white"
                        aria-label={`Preview ${displayName}`}
                        title="Preview"
                    >
                        <FiEye size={15} />
                    </button>
                ) : null}

                <a
                    href={resolvedUrl}
                    download={displayName}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 p-2 text-neutral-300 transition hover:bg-white/5 hover:text-white"
                    aria-label={`Download ${displayName}`}
                    title="Download"
                >
                    <FiDownload size={15} />
                </a>
            </div>
        </div>
    );
}

export function IssueActivityItem({ item }: Props) {
    const { user } = useAuth();
    const isMe = user?.userId === item.actorId;
    const [selectedAttachment, setSelectedAttachment] = useState<IssueAttachment | null>(null);

    // Append (you) to the actor name if it's the current user's action
    const displayTitle = isMe && item.isComment
        ? `${item.actorName} (you)`
        : isMe && !item.isComment
            ? item.title.replace(item.actorName, `${item.actorName} (you)`)
            : item.title;

    return (
        <div className="flex gap-3">
            <Avatar name={item.actorName} src={item.actorProfileImg} size="sm" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white font-semibold">{displayTitle}</p>
                    <span className="text-xs text-neutral-500">{formatDate(item.at)}</span>
                </div>

                {item.isComment ? (
                    <div className="mt-2 rounded-xl border border-white/10 p-3 bg-[#1A2234]">
                        <p className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
                            <TextWithLinks text={item.message} />
                        </p>

                        {item.attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {item.attachments.map((a) => (
                                    <AttachmentActions
                                        key={a.attachmentId}
                                        attachment={a}
                                        onPreview={setSelectedAttachment}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-2">
                        <p className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
                            <TextWithLinks text={item.message} />
                        </p>

                        {item.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {item.attachments.map((a) => (
                                    <AttachmentActions
                                        key={a.attachmentId}
                                        attachment={a}
                                        onPreview={setSelectedAttachment}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <IssueAttachmentPreviewModal
                attachment={selectedAttachment}
                onClose={() => setSelectedAttachment(null)}
            />
        </div>
    );
}
