import {
  FiActivity,
  FiAnchor,
  FiAperture,
  FiBriefcase,
  FiFolder,
  FiStar,
  FiSun,
} from "react-icons/fi";
import { FaBug, FaGoogle } from "react-icons/fa";
import { FaConnectdevelop } from "react-icons/fa6";
import { CiBank, CiMobile4, CiMonitor } from "react-icons/ci";
import { MdError, MdLiveTv, MdOutlinePrivacyTip } from "react-icons/md";

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

export const PREDEFINED_ICONS = Object.entries(PROJECT_ICONS).map(([id, icon]) => ({
  id: id as ProjectIconId,
  icon,
}));
