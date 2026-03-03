import { useState } from "react";
import { SidebarCard } from "../../components/layout/SidebarCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Priority } from "../../components/ui/Priority";
import { Tag } from "../../components/ui/Tag";
import { AvatarGroup } from "../../components/ui/AvatarGroup";
import { Button } from "../../components/ui/Button";
import { type Issue } from "../../services/api";
import { FiEdit2, FiUsers } from "react-icons/fi";

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
    const words = issue.description.split(/\s+/);
    const isLongDescription = words.length > 256;
    const displayDescription = isExpanded || !isLongDescription
        ? issue.description
        : words.slice(0, 256).join(" ") + "...";

    // Mappa colori per StatusBadge
    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case "DONE": return "emerald-500";
            case "IN_PROGRESS": return "blue-500";
            case "TODO": return "orange-500";
            default: return "neutral-400";
        }
    };

    return (
        <SidebarCard>

            <div className="flex flex-row gap-8 items-center justify-between">
                <SidebarCard.Section title="Status">
                    <StatusBadge
                        text={issue.status.replace('_', ' ')}
                        color={getStatusColor(issue.status)}
                        variant="pill"
                        glow
                    />
                </SidebarCard.Section>

                <SidebarCard.Section title="Priority">
                    <Priority level={issue.priority} />
                </SidebarCard.Section>
            </div>


            <SidebarCard.Section title="Description">
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-neutral-400 leading-relaxed break-words">
                        {displayDescription}
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

            <SidebarCard.Section title="Tags">
                <div className="flex flex-wrap gap-2">
                    {issue.tags.length > 0 ? (
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
                {issue.assignees.length > 0 ? (
                    <AvatarGroup members={issue.assignees} max={5} />
                ) : (
                    <span className="text-xs text-neutral-600 italic">No one assigned</span>
                )}
            </SidebarCard.Section>

            {/* Azioni con permessi */}
            <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                {(isAssigned || isAdmin) && (
                    <Button variant="glass" size="sm" icon={<FiEdit2 size={14} />} onClick={onEditClick}>
                        Edit Issue
                    </Button>
                )}
                {isAdmin && (
                    <Button variant="glass" size="sm" icon={<FiUsers size={14} />} onClick={onManageMembersClick}>
                        Manage Members
                    </Button>
                )}
            </div>
        </SidebarCard>
    );
}
