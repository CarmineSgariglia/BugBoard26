import type { ReactNode } from "react";

export interface ProjectMockData {
    id: string;
    color: string;
    title: string;
    description: string;
    date: string;
    authorImageUrl?: string;
    icon: ReactNode;
}

export const mockProjects: ProjectMockData[] = [
    {
        id: "proj-1",
        color: "#14B8A6", // Teal/Cyan
        title: "Client Portal",
        description: "External dashboard for client reviews and feedback gathering.",
        date: "Dec 10",
        authorImageUrl: "https://i.pravatar.cc/150?img=11",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 10h16M10 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        id: "proj-2",
        color: "#E11D48", // Rose
        title: "Backend Core API",
        description: "Refactoring of the main authentication and billing endpoints.",
        date: "Nov 24",
        authorImageUrl: "https://i.pravatar.cc/150?img=33",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        id: "proj-3",
        color: "#F59E0B", // Amber
        title: "Marketing Website",
        description: "New landing pages for the Q3 campaign launch.",
        date: "Oct 15",
        authorImageUrl: "https://i.pravatar.cc/150?img=47",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        id: "proj-4",
        color: "#af0017ff", // Amber
        title: "Marketing Website",
        description: "New landing pages for the Q3 campaign launch.",
        date: "Oct 15",
        authorImageUrl: "https://i.pravatar.cc/150?img=47",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        id: "proj-5",
        color: "#001a99ff", // Amber
        title: "Marketing Website",
        description: "New landing pages for the Q3 campaign launch.",
        date: "Oct 15",
        authorImageUrl: "https://i.pravatar.cc/150?img=47",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        id: "proj-6",
        color: "#7a8515ff", // Amber
        title: "Marketing Website",
        description: "New landing pages for the Q3 campaign launch.",
        date: "Oct 15",
        authorImageUrl: "https://i.pravatar.cc/150?img=47",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    }
];
