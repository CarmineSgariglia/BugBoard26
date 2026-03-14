import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    hasError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ hasError, className = "", ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={`flex w-full rounded-lg border p-4 text-[14px] text-white placeholder:text-neutral-500 bg-[#1A1D24]/50 outline-none transition-all duration-200 resize-none
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

Textarea.displayName = "Textarea";
