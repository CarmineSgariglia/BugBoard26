import { type ReactNode } from "react";

interface FormFieldProps {
    label?: string;
    error?: string;
    helperText?: string;
    required?: boolean;
    className?: string;
    children: ReactNode;
}

export function FormField({
    label,
    error,
    helperText,
    required,
    className = "",
    children,
}: FormFieldProps) {
    return (
        <div className={`flex w-full flex-col gap-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-white/90">
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            <div className="relative">
                {children}
            </div>

            {/* Error or Helper Text */}
            {error ? (
                <span className="text-xs font-medium text-rose-400 mt-0.5 animate-in fade-in slide-in-from-top-1">
                    {error}
                </span>
            ) : helperText ? (
                <span className="text-xs text-neutral-500 mt-0.5">
                    {helperText}
                </span>
            ) : null}
        </div>
    );
}
