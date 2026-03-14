import { useEffect, useReducer, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { IoIosNotificationsOutline } from "react-icons/io";

import { DynamicBreadcrumbs } from "./DynamicBreadcrumbs";
import { NavIconButton } from "./NavIconButton";
import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationDropdown } from "./NotificationDropdown";
import { AvatarTrigger } from "./AvatarTrigger";
import { logoutApi } from "../../shared/api/modules/auth";
import { listNotificationsApi } from "../../shared/api/modules/notifications";
import type { NotificationItem } from "../../shared/api/types/notifications";
import { useAuth } from "@shared/providers/AuthContext";
import { LogoutConfirmModal } from "./LogoutConfirmModal";

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
        isLogoutModalOpen: false,
      };
    case "TOGGLE_NOTIFICATIONS":
      return {
        ...state,
        isNotificationOpen: !state.isNotificationOpen,
        isProfileOpen: false,
        isLogoutModalOpen: false,
      };
    case "OPEN_LOGOUT":
      return {
        ...state,
        isLogoutModalOpen: true,
        isProfileOpen: false,
        isNotificationOpen: false,
      };
    case "CLOSE_ALL":
      return {
        isProfileOpen: false,
        isNotificationOpen: false,
        isLogoutModalOpen: false,
      };
    default:
      return state;
  }
}

export function TopNav() {
  const navigate = useNavigate();
  const { user: currentUser, refreshUser } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const knownNotificationIdsRef = useRef<Set<number>>(new Set());
  const notificationsInitializedRef = useRef(false);

  const [state, dispatch] = useReducer(navReducer, {
    isProfileOpen: false,
    isNotificationOpen: false,
    isLogoutModalOpen: false,
  });

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: listNotificationsApi,
    enabled: Boolean(currentUser),
    staleTime: 30000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logoutApi();
      await refreshUser();
    },
    onSuccess: () => {
      dispatch({ type: "CLOSE_ALL" });
      navigate("/login", { replace: true });
    },
    onError: (error) => {
      console.error("Logout failed", error);
    },
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      knownNotificationIdsRef.current = new Set();
      notificationsInitializedRef.current = false;
      setHasNewNotifications(false);
      return;
    }

    const currentIds = notifications.map((notification) => notification.notifyUserId);

    if (!notificationsInitializedRef.current) {
      knownNotificationIdsRef.current = new Set(currentIds);
      notificationsInitializedRef.current = true;
      return;
    }

    const hasNewIds = currentIds.some((id) => !knownNotificationIdsRef.current.has(id));
    knownNotificationIdsRef.current = new Set([...knownNotificationIdsRef.current, ...currentIds]);

    if (state.isNotificationOpen) {
      setHasNewNotifications(false);
      return;
    }

    if (hasNewIds) {
      setHasNewNotifications(true);
    }
  }, [currentUser, notifications, state.isNotificationOpen]);

  const confirmLogout = () => {
    logoutMutation.mutate();
  };

  const toggleNotifications = () => {
    if (!state.isNotificationOpen) {
      setHasNewNotifications(false);
      knownNotificationIdsRef.current = new Set(
        notifications.map((notification) => notification.notifyUserId),
      );
    }

    dispatch({ type: "TOGGLE_NOTIFICATIONS" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-[padding,background-color,backdrop-filter,border-color] duration-300 px-6 border-b flex items-center justify-between
            ${
              isScrolled
                ? "bg-[#0D0F14]/80 backdrop-blur-lg border-white/5 py-3"
                : "bg-transparent border-transparent py-5"
            }`}
    >
      <DynamicBreadcrumbs />

      <div className="flex items-center gap-6 relative">
        <div className="relative">
          <NavIconButton
            aria-label="Notifications"
            icon={<IoIosNotificationsOutline size={24} />}
            hasBadge={hasNewNotifications}
            onClick={toggleNotifications}
          />
          <NotificationDropdown
            isOpen={state.isNotificationOpen}
            onClose={() => dispatch({ type: "CLOSE_ALL" })}
          />
        </div>

        <div className="relative">
          <AvatarTrigger user={currentUser} onClick={() => dispatch({ type: "TOGGLE_PROFILE" })} />
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
        isLoading={logoutMutation.isPending}
      />
    </nav>
  );
}
