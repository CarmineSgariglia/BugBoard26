import type { ButtonHTMLAttributes, ReactNode } from "react";

interface NavIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
    hasBadge?: boolean;
    badgeLabel?: string;
}

export function NavIconButton({
    icon,
    hasBadge = false,
    badgeLabel = "New notifications",
    className = "",
    ...props
}: NavIconButtonProps) {
    return (
        <button
            className={`relative text-white p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center ${className}`}
            {...props}
        >
            {icon}
            {hasBadge ? (
                <span
                    aria-label={badgeLabel}
                    className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(13,15,20,0.92)]"
                />
            ) : null}
        </button>
    );
}
