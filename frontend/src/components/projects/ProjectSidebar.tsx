import { FiSettings, FiTrash2 } from "react-icons/fi";
import { TiUserAdd } from "react-icons/ti";
import { HiOutlineChevronRight, HiOutlineUsers } from "react-icons/hi";
import { AvatarGroup } from "../ui/AvatarGroup";
import { type Project } from "../../services/api";
import { SidebarCard } from "../layout/SidebarCard";

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
                <p className="text-sm text-neutral-400 leading-relaxed break-words">
                    {project.description || "No description provided for this project."}
                </p>
            </SidebarCard.Section>

            <SidebarCard.Section title="Members">
                <AvatarGroup members={members} />
            </SidebarCard.Section>

            <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                {isAdmin ? (
                    <>
                        <button onClick={onSettingsClick} className="group flex items-center justify-between p-3 rounded-xl bg-[#1E2332]/40 hover:bg-[#1E2332]/80 border border-white/5 hover:border-white/10 transition-all text-neutral-300 hover:text-white">
                            <div className="flex items-center gap-3">
                                <FiSettings className="text-neutral-500 group-hover:text-blue-400 transition-colors" size={18} />
                                <span className="text-sm font-medium">Edit Project</span>
                            </div>
                            <HiOutlineChevronRight className="text-neutral-600" size={16} />
                        </button>

                        <button onClick={onDeleteProjectClick} className="group flex items-center justify-between p-3 rounded-xl bg-[#1E2332]/40 hover:bg-[#1E2332]/80 border border-white/5 hover:border-white/10 transition-all text-neutral-300 hover:text-red-400">
                            <div className="flex items-center gap-3">
                                <FiTrash2 className="text-neutral-500 group-hover:text-red-400 transition-colors" size={18} />
                                <span className="text-sm font-medium">Delete Project</span>
                            </div>
                            <HiOutlineChevronRight className="text-neutral-600" size={16} />
                        </button>

                        <button onClick={onEditTeamClick} className="group flex items-center justify-between p-3 rounded-xl bg-[#1E2332]/40 hover:bg-[#1E2332]/80 border border-white/5 hover:border-white/10 transition-all text-neutral-300 hover:text-white">
                            <div className="flex items-center gap-3">
                                <TiUserAdd className="text-neutral-500 group-hover:text-emerald-400 transition-colors" size={18} />
                                <span className="text-sm font-medium">Edit Team</span>
                            </div>
                            <HiOutlineChevronRight className="text-neutral-600" size={16} />
                        </button>
                    </>
                ) : (
                    <button onClick={onViewTeamClick} className="group flex items-center justify-between p-3 rounded-xl bg-[#1E2332]/40 hover:bg-[#1E2332]/80 border border-white/5 hover:border-white/10 transition-all text-neutral-300 hover:text-white">
                        <div className="flex items-center gap-3">
                            <HiOutlineUsers className="text-neutral-500 group-hover:text-emerald-400 transition-colors" size={18} />
                            <span className="text-sm font-medium">View Team</span>
                        </div>
                        <HiOutlineChevronRight className="text-neutral-600" size={16} />
                    </button>
                )}
            </div>
        </SidebarCard>
    );
}
