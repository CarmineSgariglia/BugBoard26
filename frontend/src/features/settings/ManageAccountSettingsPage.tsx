import { useState } from "react";
import { SettingsSidebar } from "../../widgets/settings/SettingsSidebar";
import { ProfileSettingsSection } from "../../widgets/settings/ProfileSettingsSection";
import { AddUsersSection } from "../../widgets/settings/AddUsersSection";
import { ManageUsersSection } from "../../widgets/settings/ManageUsersSection";
import { useAuth } from "../../app/providers/AuthContext";

export function ManageAccountSettingsPage() {
    const { user } = useAuth();
    const isAdmin = user?.isAdmin || false;
    const [activeTab, setActiveTab] = useState<"profile" | "add_users" | "manage_users">("profile");
    const [isEditingUser, setIsEditingUser] = useState(false);

    const handleTabChange = (tab: "profile" | "add_users" | "manage_users") => {
        setActiveTab(tab);
        setIsEditingUser(false);
    };

    // Use the wide table layout ONLY when on manage_users AND not editing a single user
    const useWideLayout = activeTab === "manage_users" && !isEditingUser;

    return (
        <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col relative">

            {/* Split Layout Container */}
            <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col md:flex-row items-start relative z-10 px-6 pt-28 pb-10">

                {/* Left Column (Sidebar) - Only for Admins */}
                {isAdmin && (
                    <div className="w-full md:w-72 flex justify-center md:block flex-shrink-0 relative z-20 md:sticky md:top-28">
                        <SettingsSidebar
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                        />
                    </div>
                )}

                {/* Center Column */}
                <div className={`flex-1 w-full mt-8 md:mt-0 relative z-10 transition-all ${useWideLayout ? "pl-0 md:pl-12 lg:pl-16 pr-0 md:pr-4" : "flex justify-center px-4"}`}>
                    <div className={`w-full transition-all ${useWideLayout ? "w-full" : "max-w-lg"}`}>
                        {activeTab === "profile" && <ProfileSettingsSection isAdmin={isAdmin} />}
                        {activeTab === "add_users" && <AddUsersSection />}
                        {activeTab === "manage_users" && <ManageUsersSection onEditingChange={setIsEditingUser} />}
                    </div>
                </div>

                {/* Right Column Spacer (To force mathematical centering) - Only for Admins */}
                {isAdmin && !useWideLayout && (
                    <div className="hidden lg:block w-72 flex-shrink-0 transition-all"></div>
                )}
            </div>
        </div>
    );
}
