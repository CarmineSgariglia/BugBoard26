import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
    ({ error, className = "", ...props }, ref) => {
        return (
            <div className="flex w-full flex-col">
                <input
                    ref={ref}
                    className={`h-11 w-full rounded-lg border px-4 text-[14px] text-white placeholder-neutral-500 bg-white/[0.03] outline-none transition-all
            ${error
                            ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                            : "border-white/5 focus:border-white/20 focus:ring-1 focus:ring-white/20"
                        } ${className}`}
                    {...props}
                />
                {error && <span className="mt-1 text-xs text-red-400">{error}</span>}
            </div>
        );
    }
);

