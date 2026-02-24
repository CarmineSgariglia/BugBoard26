import type { ButtonHTMLAttributes, ReactNode } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
}

export function PrimaryButton({ children, className = "", ...props }: PrimaryButtonProps) {
    return (
        <button
            className={`mt-4 h-11 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50 ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
