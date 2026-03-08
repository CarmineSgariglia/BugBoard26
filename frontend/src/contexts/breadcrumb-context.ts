import { createContext } from "react";

export interface BreadcrumbContextType {
    labels: Record<string, string>;
    setLabel: (key: string, label: string) => void;
}

export const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);
