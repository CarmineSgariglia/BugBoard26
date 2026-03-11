import {
    FiFolderPlus,
    FiFolderMinus,
    FiUserX,
    FiUserCheck,
    FiCheckCircle,
    FiFilePlus,
    FiRefreshCw,
    FiBell
} from "react-icons/fi";
import type { NotificationType } from "../../shared/api/types/notifications";

export function getNotificationIcon(type: NotificationType) {
    switch (type) {
        case "PROJECT_ADDED":
            return <FiFolderPlus size={18} className="text-emerald-400" />;
        case "PROJECT_REMOVED":
            return <FiFolderMinus size={18} className="text-rose-400" />;
        case "UNASSIGNED_PROJECT":
        case "ISSUE_UNASSIGNED":
            return <FiUserX size={18} className="text-orange-400" />;
        case "ISSUE_ASSIGNED":
            return <FiUserCheck size={18} className="text-cyan-400" />;
        case "ISSUE_ADDED":
            return <FiFilePlus size={18} className="text-indigo-400" />;
        case "ISSUE_CLOSED":
            return <FiCheckCircle size={18} className="text-emerald-400" />;
        case "ISSUE_UPDATED":
            return <FiRefreshCw size={18} className="text-blue-400" />;
        default:
            return <FiBell size={18} className="text-neutral-400" />;
    }
}
