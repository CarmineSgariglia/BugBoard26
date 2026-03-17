import { useState } from "react";

import { useAuth } from "@features/auth";
import type { SettingsTab } from "@features/settings/model/types";
import { AddUsersSection } from "./AddUsersSection";
import { ManageUsersSection } from "./ManageUsersSection";
import { ProfileSettingsSection } from "./ProfileSettingsSection";
import { SettingsSidebar } from "./SettingsSidebar";

export function ManageAccountSettingsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isEditingUser, setIsEditingUser] = useState(false);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setIsEditingUser(false);
  };

  const useWideLayout = activeTab === "manage_users" && !isEditingUser;

  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col relative">
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col md:flex-row items-start relative z-10 px-6 pt-28 pb-10">
        {isAdmin && (
          <div className="w-full md:w-72 flex justify-center md:block flex-shrink-0 relative z-20 md:sticky md:top-28">
            <SettingsSidebar activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        )}

        <div
          className={`flex-1 w-full mt-8 md:mt-0 relative z-10 transition-all ${
            useWideLayout ? "pl-0 md:pl-12 lg:pl-16 pr-0 md:pr-4" : "flex justify-center px-4"
          }`}
        >
          <div className={`w-full transition-all ${useWideLayout ? "w-full" : "max-w-lg"}`}>
            {activeTab === "profile" && <ProfileSettingsSection isAdmin={isAdmin} />}
            {activeTab === "add_users" && <AddUsersSection />}
            {activeTab === "manage_users" && <ManageUsersSection onEditingChange={setIsEditingUser} />}
          </div>
        </div>

        {isAdmin && !useWideLayout && (
          <div className="hidden lg:block w-72 flex-shrink-0 transition-all"></div>
        )}
      </div>
    </div>
  );
}
