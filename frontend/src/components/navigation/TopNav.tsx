import { useEffect, useState, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { DynamicBreadcrumbs } from "./DynamicBreadcrumbs";
import { NavIconButton } from "./NavIconButton";
import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationDropdown } from "./NotificationDropdown";
import { AvatarTrigger } from "./AvatarTrigger";
import { logoutApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { LogoutConfirmModal } from "./LogoutConfirmModal";
import { IoIosNotificationsOutline } from "react-icons/io";


type NavState = {
    isProfileOpen: boolean;
    isNotificationOpen: boolean;
    isLogoutModalOpen: boolean;
};

type NavAction =
    | { type: "TOGGLE_PROFILE" }
    | { type: "TOGGLE_NOTIFICATIONS" }
    | { type: "OPEN_LOGOUT" }
    | { type: "CLOSE_ALL" };

function navReducer(state: NavState, action: NavAction): NavState {
    switch (action.type) {
        case "TOGGLE_PROFILE":
            return {
                ...state,
                isProfileOpen: !state.isProfileOpen,
                isNotificationOpen: false,
                isLogoutModalOpen: false
            };
        case "TOGGLE_NOTIFICATIONS":
            return {
                ...state,
                isNotificationOpen: !state.isNotificationOpen,
                isProfileOpen: false,
                isLogoutModalOpen: false
            };
        case "OPEN_LOGOUT":
            return {
                ...state,
                isLogoutModalOpen: true,
                isProfileOpen: false,
                isNotificationOpen: false
            };
        case "CLOSE_ALL":
            return {
                isProfileOpen: false,
                isNotificationOpen: false,
                isLogoutModalOpen: false
            };
        default:
            return state;
    }
}

export function TopNav() {
    const navigate = useNavigate();
    const { user: currentUser, refreshUser } = useAuth();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const [state, dispatch] = useReducer(navReducer, {
        isProfileOpen: false,
        isNotificationOpen: false,
        isLogoutModalOpen: false
    });

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const confirmLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logoutApi();
            await refreshUser();
            dispatch({ type: "CLOSE_ALL" });
            navigate("/login", { replace: true }); // With replace: true, the user cannot go back to the previous page
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-5 flex items-center justify-between
            ${isScrolled ? "bg-[#0D0F14]/80 backdrop-blur-lg border-b border-white/5 py-3" : "bg-transparent"}`}>

            <DynamicBreadcrumbs />

            <div className="flex items-center gap-6 relative">
                {/* Notification Bell */}
                <div className="relative">
                    <NavIconButton
                        icon={
                            <IoIosNotificationsOutline size={24} />
                        }
                        onClick={() => dispatch({ type: "TOGGLE_NOTIFICATIONS" })}
                    />
                    <NotificationDropdown
                        isOpen={state.isNotificationOpen}
                        onClose={() => dispatch({ type: "CLOSE_ALL" })}
                    />
                </div>

                {/* Profile Avatar */}
                <div className="relative">
                    <AvatarTrigger
                        user={currentUser}
                        onClick={() => dispatch({ type: "TOGGLE_PROFILE" })}
                    />
                    <ProfileDropdown
                        isOpen={state.isProfileOpen}
                        onClose={() => dispatch({ type: "CLOSE_ALL" })}
                        onLogout={() => dispatch({ type: "OPEN_LOGOUT" })}
                    />
                </div>
            </div>

            <LogoutConfirmModal
                isOpen={state.isLogoutModalOpen}
                onClose={() => dispatch({ type: "CLOSE_ALL" })}
                onConfirm={confirmLogout}
                isLoading={isLoggingOut}
            />
        </nav>
    );
}

