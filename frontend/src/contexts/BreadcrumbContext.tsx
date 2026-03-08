import { useState, useCallback, type ReactNode } from "react";
import { BreadcrumbContext } from "./breadcrumb-context";

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
    const [labels, setLabels] = useState<Record<string, string>>({});

    const setLabel = useCallback((key: string, label: string) => {
        setLabels(prev => {
            if (prev[key] === label) return prev;
            return { ...prev, [key]: label };
        });
    }, []);

    return (
        <BreadcrumbContext.Provider value={{ labels, setLabel }}>
            {children}
        </BreadcrumbContext.Provider>
    );
}
