import { useState } from "react";
import { SidebarCard } from "../../components/layout/SidebarCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Priority } from "../../components/ui/Priority";
import { Tag } from "../../components/ui/Tag";
import { AvatarGroup } from "../../components/ui/AvatarGroup";
import type { Issue } from "../../shared/api/types/issues";
import { FiEdit2, FiUsers } from "react-icons/fi";
import { SidebarButton } from "../../components/ui/SidebarButton";
import { Avatar } from "../../components/ui/Avatar";
import { ScrollComponent } from "../../components/ui/ScrollComponent";


interface IssueDetailsSidebarProps {
    issue: Issue;
    isAdmin?: boolean;
    isAssigned?: boolean; // Se l'utente loggato è tra gli assegnatari
    onEditClick?: () => void;
    onManageMembersClick?: () => void;
}

export function IssueDetailsSidebar({
    issue,
    isAdmin,
    isAssigned,
    onEditClick,
    onManageMembersClick
}: IssueDetailsSidebarProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Logica 256 parole per la descrizione
    const description = issue.description || "";
    const words = description.split(/\s+/);
    const isLongDescription = words.length > 256;
    const displayDescription = isExpanded || !isLongDescription
        ? description
        : words.slice(0, 256).join(" ") + "...";

    // Mappa colori per StatusBadge
    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case "DONE": return "emerald-500";
            case "IN_PROGRESS": return "blue-500";
            case "TODO": return "orange-500";
            case "CANCELLED": return "rose-500";
            default: return "neutral-400";
        }
    };

    return (
        <SidebarCard>

            <div className="flex flex-row gap-8 items-center justify-between">
                <SidebarCard.Section title="Status" className="items-center">
                    <StatusBadge
                        text={issue.status.replace('_', ' ')}
                        color={getStatusColor(issue.status)}
                        variant="pill"
                        glow
                    />
                </SidebarCard.Section>

                <SidebarCard.Section title="Type" className="items-center">
                    <Tag
                        text={issue.type}
                    />
                </SidebarCard.Section>

                <SidebarCard.Section title="Priority" className="items-center">
                    <Priority level={issue.priority} />
                </SidebarCard.Section>
            </div>

            <SidebarCard.Section title="Description">

                <div className="flex flex-col gap-2">
                    <p className="text-sm text-neutral-400 leading-relaxed break-words">
                        <ScrollComponent maxHeight="max-h-[150px]">
                            {displayDescription}
                        </ScrollComponent>
                    </p>
                    {isLongDescription && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors w-fit"
                        >
                            {isExpanded ? "Show Less" : "Read More"}
                        </button>
                    )}
                </div>

            </SidebarCard.Section>

            <SidebarCard.Section title="Reporter">
                <div className="flex items-center gap-3">
                    <Avatar
                        name={issue.reporter?.username || "Unknown"}
                        src={issue.reporter?.profileImg}
                        size="md"
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{issue.reporter?.username || "Unknown Reporter"}</span>
                        <span className="text-xs text-neutral-500">{issue.reporter?.email || "No email available"}</span>
                    </div>
                </div>
            </SidebarCard.Section>

            <SidebarCard.Section title="Tags">
                <div className="flex flex-wrap gap-2">
                    {issue.tags && issue.tags.length > 0 ? (
                        issue.tags.map(tag => (
                            <Tag
                                key={tag.tagId}
                                text={tag.name.toUpperCase()}
                                textColor="text-blue-500"
                                borderColor="border-blue-500/20"
                                className="bg-blue-500/5"
                            />
                        ))
                    ) : (
                        <span className="text-xs text-neutral-600 italic">No tags</span>
                    )}
                </div>
            </SidebarCard.Section>

            <SidebarCard.Section title="Assigned To">
                {issue.assignees && issue.assignees.length > 0 ? (
                    <AvatarGroup members={issue.assignees} max={5} />
                ) : (
                    <span className="text-xs text-neutral-600 italic">No one assigned</span>
                )}
            </SidebarCard.Section>

            {/* Azioni con permessi */}
            <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                {(isAssigned || isAdmin) && (
                    <SidebarButton
                        icon={<FiEdit2 size={14} />}
                        label="Edit Issue"
                        onClick={onEditClick}
                        variant="primary"
                    />
                )}
                {isAdmin && (
                    <SidebarButton
                        icon={<FiUsers size={14} />}
                        label="Edit Members"
                        onClick={onManageMembersClick}
                        variant="success"
                    />
                )}
            </div>
        </SidebarCard>
    );
}
