import { FiEdit2, FiEye } from "react-icons/fi";
import { AvatarGroup } from "@shared/ui/AvatarGroup";
import { SidebarCard } from "./SidebarCard";

interface SidebarMembersSectionProps {
    title?: string;
    members: Array<{ profileImg?: string | null; username: string }>;
    isAdmin?: boolean;
    onActionClick?: () => void;
    max?: number;
    adminLabel?: string;
    userLabel?: string;
    emptyText?: string;
}

export function SidebarMembersSection({
    title = "Members",
    members,
    isAdmin,
    onActionClick,
    max = 4,
    adminLabel = "Manage members",
    userLabel = "View members",
    emptyText,
}: SidebarMembersSectionProps) {
    const actionLabel = isAdmin ? adminLabel : userLabel;

    return (
        <SidebarCard.Section title={title}>
            <AvatarGroup
                members={members}
                max={max}
                action={{
                    icon: isAdmin ? <FiEdit2 size={14} /> : <FiEye size={14} />,
                    label: actionLabel,
                    onClick: onActionClick,
                }}
            />
            {members.length === 0 && emptyText ? (
                <span className="text-xs text-neutral-600 italic">{emptyText}</span>
            ) : null}
        </SidebarCard.Section>
    );
}
