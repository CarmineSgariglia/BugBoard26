import { GlassCard } from "../../shared/ui/GlassCard";
import { useNavigate } from "react-router-dom";
import { handleGetHelp } from "../../shared/lib/help";

// Icons
import { FaUser, FaUserFriends } from "react-icons/fa";
import { TiUserAdd } from "react-icons/ti";
import { RiArrowGoBackLine } from "react-icons/ri";
import { MdOutlineMail } from "react-icons/md";


interface SettingsSidebarProps {
    activeTab: "profile" | "add_users" | "manage_users";
    onTabChange: (tab: "profile" | "add_users" | "manage_users") => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
    const navigate = useNavigate();

    const getTabClass = (tabId: string) => {
        // Se è la tab attiva, il cursore diventa "default" anziché "pointer" (manina)
        const baseClass = "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer";
        return activeTab === tabId
            ? `${baseClass} bg-[#2D3343] text-white rounded-lg mx-2 mt-2 cursor-default`
            : `${baseClass} text-neutral-400 hover:text-white mx-2 mt-2 rounded-lg`;
    };


    const handleExit = () => {
        navigate(-1);
    };



    return (
        <GlassCard className="w-[260px] flex-shrink-0 pb-4 h-fit flex flex-col justify-between min-h-[400px]">
            <div className="flex flex-col pt-2">

                {/* Profile Settings */}
                <div
                    className={getTabClass("profile")}
                    onClick={() => {
                        if (activeTab !== "profile") onTabChange("profile")
                    }}
                >
                    <FaUser size={18} />
                    Profile Settings
                </div>

                {/* Admin Controls Line Divider */}
                {(
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="px-6 text-[10px] font-bold tracking-wider text-neutral-500 uppercase mb-1">
                            Admin Controls
                        </p>

                        <div
                            className={getTabClass("add_users")}
                            onClick={() => {
                                if (activeTab !== "add_users") onTabChange("add_users");
                            }}
                        >
                            <TiUserAdd size={18} />
                            Add Users
                        </div>

                        <div
                            className={getTabClass("manage_users")}
                            onClick={() => {
                                if (activeTab !== "manage_users") onTabChange("manage_users");
                            }}
                        >
                            <FaUserFriends size={18} />
                            Manage Users
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Admin Actions */}
            {(
                <div className="mt-8 pt-4 border-t border-white/5 flex flex-col gap-1">
                    <div
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer text-neutral-400 hover:text-white mx-2 mt-2 rounded-lg"
                        onClick={handleGetHelp}
                    >
                        <MdOutlineMail size={18} />
                        Get Help
                    </div>
                    <div
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer text-neutral-400 hover:text-white mx-2 rounded-lg"
                        onClick={handleExit}
                    >
                        <RiArrowGoBackLine size={18} />
                        Exit
                    </div>
                </div>
            )}
        </GlassCard>
    );
}
