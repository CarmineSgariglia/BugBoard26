import { GlassCard } from "../ui/GlassCard";
import { FaUser, FaUserFriends } from "react-icons/fa";
import { TiUserAdd } from "react-icons/ti";

interface SettingsSidebarProps {
    isAdmin: boolean;
    activeTab: "profile" | "add_users" | "manage_users";
    onTabChange: (tab: "profile" | "add_users" | "manage_users") => void;
}

export function SettingsSidebar({ isAdmin, activeTab, onTabChange }: SettingsSidebarProps) {
    const getTabClass = (tabId: string) => {
        const baseClass = "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer";
        return activeTab === tabId
            ? `${baseClass} bg-[#2D3343] text-white rounded-lg mx-2 mt-2`
            : `${baseClass} text-neutral-400 hover:text-white mx-2 mt-2 rounded-lg`;
    };

    return (
        <GlassCard className="w-[260px] flex-shrink-0 pb-4">
            <div className="flex flex-col pt-2 h-full">
                {/* Profile Settings */}
                <div
                    className={getTabClass("profile")}
                    onClick={() => onTabChange("profile")}
                >
                    <FaUser size={18} />
                    Profile Settings
                </div>

                {/* Admin Controls Line Divider */}
                {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="px-6 text-[10px] font-bold tracking-wider text-neutral-500 uppercase mb-1">
                            Admin Controls
                        </p>

                        <div
                            className={getTabClass("add_users")}
                            onClick={() => onTabChange("add_users")}
                        >
                            <TiUserAdd size={18} />
                            Add Users
                        </div>

                        <div
                            className={getTabClass("manage_users")}
                            onClick={() => onTabChange("manage_users")}
                        >
                            <FaUserFriends size={18} />
                            Manage Users
                        </div>
                    </div>
                )}
            </div>
        </GlassCard>
    );
}
