import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface BreadcrumbContextType {
    labels: Record<string, string>;
    setLabel: (key: string, label: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

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

export function useBreadcrumbs() {
    const context = useContext(BreadcrumbContext);
    if (!context) {
        throw new Error("useBreadcrumbs must be used within a BreadcrumbProvider");
    }
    return context;
}
