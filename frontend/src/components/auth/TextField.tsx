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
                    className={`h-11 w-full rounded-lg border bg-[#13151A] px-4 text-[14px] text-[#E2E8F0] placeholder-[#64748B] outline-none transition-colors 
            ${error
                            ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                            : "border-[#2D3342] focus:border-[#4B5563] focus:ring-1 focus:ring-[#4B5563]"
                        } ${className}`}
                    {...props}
                />
                {error && <span className="mt-1 text-xs text-red-400">{error}</span>}
            </div>
        );
    }
);

