import type { ReactNode } from "react";

interface AuthCardProps {
    children: ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
    return (
        <div className="w-full rounded-[20px] bg-[#1A1D24] p-8 shadow-[0_0_50px_-12px_rgba(59,130,246,0.12)] flex flex-col">
            {children}
        </div>
    );
}
