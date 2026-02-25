import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBrand } from "./NavBrand";
import { NavIconButton } from "./NavIconButton";
import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationDropdown } from "./NotificationDropdown";
import { logoutApi, meApi, resolveMediaUrl, type AuthUser } from "../../services/api";

export function TopNav() {
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        const run = async () => {
            try {
                const me = await meApi();
                setCurrentUser(me);
            } catch {
                setCurrentUser(null);
            }
        };
        run();
    }, []);

    const handleLogout = async () => {
        try {
            await logoutApi();
        } finally {
            navigate("/login", { replace: true });
        }
    };

    return (
        <nav className="w-full relative px-6 py-4 flex items-center justify-between bg-transparent z-40 selection:bg-white/20">
            {/* Left side: Brand Logo & Projects Text */}
            <NavBrand />

            {/* Right side: Actions */}
            <div className="flex items-center gap-6 relative">
                {/* Search (Optional based on icon presence, omitted here as reference focuses on Bell and Avatar only) */}

                {/* Notification Bell */}
                <div className="relative">
                    <NavIconButton
                        icon={
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 15V11C18 7.68629 15.3137 5 12 5C8.68629 5 6 7.68629 6 11V15L4 17H20L18 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M10 19C10 20.1046 10.8954 21 12 21C13.1046 21 14 20.1046 14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        }
                        onClick={() => {
                            setIsNotificationOpen(!isNotificationOpen);
                            setIsProfileOpen(false); // Close other
                        }}
                    />
                    <NotificationDropdown
                        isOpen={isNotificationOpen}
                        onClose={() => setIsNotificationOpen(false)}
                    />
                </div>

                {/* Profile Avatar Trigger */}
                <div className="relative">
                    <button
                        className="w-8 h-8 rounded-full bg-slate-200 outline-none hover:ring-2 hover:ring-white/20 transition-all flex-shrink-0"
                        onClick={() => {
                            setIsProfileOpen(!isProfileOpen);
                            setIsNotificationOpen(false); // Close other
                        }}
                    >
                        {currentUser?.profileImg ? (
                            <img
                                src={resolveMediaUrl(currentUser.profileImg)}
                                alt={currentUser.username}
                                className="h-full w-full rounded-full object-cover"
                            />
                        ) : (
                            <span className="block text-xs font-semibold text-slate-800">
                                {(currentUser?.username ?? "U").slice(0, 1).toUpperCase()}
                            </span>
                        )}
                    </button>
                    <ProfileDropdown
                        isOpen={isProfileOpen}
                        onClose={() => setIsProfileOpen(false)}
                        onLogout={handleLogout}
                    />
                </div>
            </div>
        </nav>
    );
}
