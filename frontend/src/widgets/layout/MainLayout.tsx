/*
  Main layout for authenticated routes, including app background and top navigation.
*/

import { Outlet } from "react-router-dom";
import { AppBackground } from "./AppBackground";
import { TopNav } from "@widgets/navigation/TopNav";
import { NotificationsRealtimeListener } from "@features/notification/ui/NotificationsRealtimeListener";

export function MainLayout() {
    return (
        <>
            <AppBackground /> {/* Background of the application */}
            <div className="relative z-10">
                <NotificationsRealtimeListener />
                <TopNav /> {/* Top navigation bar */}
                <Outlet /> {/* Here we render the ProjectsPage, ProjectIssuesPage, or ManageAccountSettingsPage.... */}
            </div>
        </>
    );
}
