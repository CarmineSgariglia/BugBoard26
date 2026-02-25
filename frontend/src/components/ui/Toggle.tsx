import type { ButtonHTMLAttributes } from "react";

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string; // Optional label text for accessibility
}

export function Toggle({ checked, onChange, label, className = "", ...props }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#1A1D24] ${checked ? 'bg-[#3DD66A]' : 'bg-white/10'
                } ${className}`}
            {...props}
        >
            <span className="sr-only">{label || "Toggle"}</span>

            {/* The "I" icon when active */}
            <span className={`pointer-events-none absolute left-3 text-[11px] font-bold text-white transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}>
                |
            </span>

            <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-2.5' : '-translate-x-3'
                    }`}
            />
        </button>
    );
}
