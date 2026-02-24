import type { ReactNode, ButtonHTMLAttributes } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    className?: string;
    destructive?: boolean;
}

export function GlassButton({ children, className = "", destructive = false, ...props }: GlassButtonProps) {
    return (
        <button
            className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-[16px] hover:bg-white/10 border border-transparent hover:border-white/5 transition-all text-sm font-medium
            ${destructive ? "text-red-500" : "text-white"} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
