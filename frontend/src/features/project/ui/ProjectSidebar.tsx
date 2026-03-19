import { FiSettings } from "react-icons/fi";
import type { Project } from "@shared/api/types/projects";
import { Toggle } from "@shared/ui/Toggle";
import { SidebarButton } from "@shared/ui/SidebarButton";
import { ScrollComponent } from "@shared/ui/ScrollComponent";
import { SidebarCard } from "@widgets/layout/SidebarCard";
import { SidebarMembersSection } from "@widgets/layout/SidebarMembersSection";

interface ProjectSidebarProps {
    project: Project;
    members: Array<{ profileImg?: string | null; username: string }>;
    isAdmin?: boolean;
    onSettingsClick?: () => void;
    onEditTeamClick?: () => void;
    onViewTeamClick?: () => void;
    subscriptionChecked?: boolean;
    subscriptionDisabled?: boolean;
    subscriptionError?: string;
    onSubscriptionChange?: (checked: boolean) => void;
}

export function ProjectSidebar({
    project, members, isAdmin,
    onSettingsClick, onEditTeamClick, onViewTeamClick,
    subscriptionChecked = false,
    subscriptionDisabled = false,
    subscriptionError = "",
    onSubscriptionChange,
}: ProjectSidebarProps) {
    return (
        <SidebarCard>
            <SidebarCard.Section title="Project Description">
                <ScrollComponent maxHeight="max-h-[150px]">
                    <p className="text-sm text-neutral-400 leading-relaxed break-words">
                        {project.description || "No description provided for this project."}
                    </p>
                </ScrollComponent>
            </SidebarCard.Section>

            <SidebarMembersSection
                title="Members"
                members={members}
                isAdmin={isAdmin}
                onActionClick={isAdmin ? onEditTeamClick : onViewTeamClick}
                adminLabel="Manage members"
                userLabel="View members"
            />

            {isAdmin ? (
                <SidebarCard.Section title="Project notifications">
                    <div className="flex items-start justify-between gap-4">
                        <p className="text-sm text-neutral-400 leading-relaxed">
                            Receive notifications for new issues and issue closures in this project.
                        </p>
                        <Toggle
                            checked={subscriptionChecked}
                            onChange={(checked) => onSubscriptionChange?.(checked)}
                            disabled={subscriptionDisabled}
                            label="Project notifications"
                        />
                    </div>
                    {subscriptionError ? (
                        <p className="mt-3 text-xs text-rose-400">{subscriptionError}</p>
                    ) : null}
                </SidebarCard.Section>
            ) : null}

            <div>
                {isAdmin && (
                    <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                        <SidebarButton
                            icon={<FiSettings size={18} />}
                            label="Edit Project"
                            onClick={onSettingsClick}
                            variant="primary"
                        />
                    </div>
                )}
            </div>
        </SidebarCard>
    );
}
