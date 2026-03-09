import type { ButtonHTMLAttributes, ReactNode } from "react";

interface NavIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
}

export function NavIconButton({ icon, className = "", ...props }: NavIconButtonProps) {
    return (
        <button
            className={`text-white p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center ${className}`}
            {...props}
        >
            {icon}
        </button>
    );
}
