import { type ReactNode } from "react";
import { resolveMediaUrl } from "../api/core/media";

interface AvatarGroupProps {
    members: Array<{ profileImg?: string | null; username: string }>;
    max?: number;
    action?: {
        icon: ReactNode;
        label: string;
        onClick?: () => void;
    };
}

export function AvatarGroup({ members, max = 4, action }: AvatarGroupProps) {
    const visibleMembers = members.slice(0, max);
    const remaining = members.length - max;

    return (
        <div className="flex -space-x-3 items-center">
            {visibleMembers.map((member, i) => (
                <div
                    key={i}
                    className="relative inline-block h-8 w-8 rounded-full ring-2 ring-[#0D0D12] bg-[#1E2332] overflow-hidden"
                    title={member.username}
                >
                    <img
                        className="h-full w-full object-cover"
                        src={
                            resolveMediaUrl(member.profileImg || undefined) ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(member.username)}&background=random`
                        }
                        alt={member.username}
                    />
                </div>
            ))}

            {remaining > 0 && (
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#1E2332] text-[10px] font-bold text-neutral-400 ring-2 ring-[#0D0D12]">
                    +{remaining}
                </div>
            )}

            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    title={action.label}
                    aria-label={action.label}
                    className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#1E2332] text-neutral-300 ring-2 ring-[#0D0D12] hover:text-white hover:bg-[#2A3147] transition-colors"
                >
                    {action.icon}
                </button>
            )}
        </div>
    );
}
