import { PROJECT_ICONS, type ProjectIconId } from "./projectIconRegistry";

/**
 * Helper per renderizzare l'icona dato un ID
 */
export function getProjectIcon(id: string, size: number = 20, className: string = "") {
  const IconComponent = PROJECT_ICONS[id as ProjectIconId] || PROJECT_ICONS.folder;
  return <IconComponent size={size} className={className} />;
}
