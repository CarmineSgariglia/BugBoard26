{/* 
    Main layout for authenticated users.
    It contains the top navigation bar and the main content area
    The main content area is where we render the ProjectsPage, ProjectIssuesPage, or ManageAccountSettingsPage....
*/}


import { Outlet } from "react-router-dom";
import { AppBackground } from "./AppBackground";
import { TopNav } from "../../widgets/navigation/TopNav";
import { NotificationsRealtimeListener } from "../../widgets/navigation/NotificationsRealtimeListener";

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
