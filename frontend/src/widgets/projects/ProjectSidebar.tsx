import { FiSettings, FiTrash2 } from "react-icons/fi";
import { TiUserAdd } from "react-icons/ti";
import { HiOutlineUsers } from "react-icons/hi";
import { AvatarGroup } from "../ui/AvatarGroup";
import type { Project } from "../../shared/api/types/projects";
import { SidebarCard } from "../layout/SidebarCard";
import { SidebarButton } from "../ui/SidebarButton";
import { ScrollComponent } from "../ui/ScrollComponent";

interface ProjectSidebarProps {
    project: Project;
    members: Array<{ profileImg?: string | null; username: string }>;
    isAdmin?: boolean;
    onSettingsClick?: () => void;
    onEditTeamClick?: () => void;
    onDeleteProjectClick?: () => void;
    onViewTeamClick?: () => void;
}

export function ProjectSidebar({
    project, members, isAdmin,
    onSettingsClick, onEditTeamClick, onDeleteProjectClick, onViewTeamClick
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

            <SidebarCard.Section title="Members">
                <AvatarGroup members={members} />
            </SidebarCard.Section>

            <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                {isAdmin ? (
                    <>
                        <SidebarButton
                            icon={<FiSettings size={18} />}
                            label="Edit Project"
                            onClick={onSettingsClick}
                            variant="primary"
                        />

                        <SidebarButton
                            icon={<FiTrash2 size={18} />}
                            label="Delete Project"
                            onClick={onDeleteProjectClick}
                            variant="danger"
                        />

                        <SidebarButton
                            icon={<TiUserAdd size={18} />}
                            label="Edit Team"
                            onClick={onEditTeamClick}
                            variant="success"
                        />
                    </>
                ) : (
                    <SidebarButton
                        icon={<HiOutlineUsers size={18} />}
                        label="View Team"
                        onClick={onViewTeamClick}
                        variant="success"
                    />
                )}
            </div>
        </SidebarCard>
    );
}
