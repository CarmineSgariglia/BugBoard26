import {
    FiFolder,
    FiStar,
    FiSun,
    FiActivity,
    FiAnchor,
    FiAperture,
    FiBriefcase
} from "react-icons/fi";

import { FaGoogle, FaBug } from "react-icons/fa";
import { MdLiveTv, MdError, MdOutlinePrivacyTip } from "react-icons/md";
import { FaConnectdevelop } from "react-icons/fa6";
import { CiMobile4, CiMonitor, CiBank } from "react-icons/ci";

/**
 * Registro centrale delle icone del progetto.
 * Mappa un ID (stringa salvata nel DB) al componente React corrispondente.
 */
export const PROJECT_ICONS = {
    folder: FiFolder,
    star: FiStar,
    sun: FiSun,
    activity: FiActivity,
    anchor: FiAnchor,
    aperture: FiAperture,
    briefcase: FiBriefcase,
    google: FaGoogle,
    bug: FaBug,
    liveTv: MdLiveTv,
    error: MdError,
    privacyTip: MdOutlinePrivacyTip,
    connectdevelop: FaConnectdevelop,
    mobile: CiMobile4,
    monitor: CiMonitor,
    bank: CiBank,
};

export type ProjectIconId = keyof typeof PROJECT_ICONS;

/**
 * Helper per ottenere l'elenco delle icone per la UI di selezione (Step 1)
 */
export const PREDEFINED_ICONS = Object.entries(PROJECT_ICONS).map(([id, icon]) => ({
    id: id as ProjectIconId,
    icon
}));

/**
 * Helper per renderizzare l'icona dato un ID
 */
export function getProjectIcon(id: string, size: number = 20, className: string = "") {
    const IconComponent = PROJECT_ICONS[id as ProjectIconId] || PROJECT_ICONS.folder;
    return <IconComponent size={size} className={className} />;
}
