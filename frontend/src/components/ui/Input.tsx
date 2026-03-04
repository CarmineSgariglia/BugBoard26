import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ hasError, className = "", ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={`flex h-11 w-full rounded-lg border px-4 text-[14px] text-white placeholder:text-neutral-500 bg-[#1A1D24]/50 outline-none transition-all duration-200
                    ${hasError
                        ? "border-rose-500/50 bg-rose-500/5 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                        : "border-white/10 hover:border-white/20 focus:border-[#5671F6] focus:bg-[#1A1D24] focus:ring-1 focus:ring-[#5671F6]/30"
                    } 
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${className}`}
                {...props}
            />
        );
    }
);

Input.displayName = "Input";
