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
        <div className="w-[260px] flex-shrink-0 rounded-2xl bg-[#1A1D24]/90 border border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl h-fit pb-4">
            <div className="flex flex-col pt-2">
                {/* Profile Settings */}
                <div
                    className={getTabClass("profile")}
                    onClick={() => onTabChange("profile")}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6 21V19C6 17.8954 6.89543 17 8 17H16C17.1046 17 18 17.8954 18 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 21V19C16 17.8954 15.1046 17 14 17H5C3.89543 17 3 17.8954 3 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M20 8V14M17 11H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Add Users
                        </div>

                        <div
                            className={getTabClass("manage_users")}
                            onClick={() => onTabChange("manage_users")}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17 21V19C17 17.8954 16.1046 17 15 17H5C3.89543 17 3 17.8954 3 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Manage Users
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
