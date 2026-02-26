import type { ChangeEvent } from "react";

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface SelectProps {
    value: string | number;
    onChange: (value: string) => void;
    options: SelectOption[];
    className?: string;
    disabled?: boolean;
}

export function Select({
    value,
    onChange,
    options,
    className = "",
    disabled = false
}: SelectProps) {
    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
    };

    return (
        <select
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className={`w-full h-[46px] rounded-full bg-[#1A1D24] border border-white/5 px-5 text-sm text-white focus:border-white/20 focus:outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg stroke='rgba(255,255,255,0.4)' fill='none' stroke-width='2' viewBox='0 0 24 24' stroke-linecap='round' stroke-linejoin='round' height='1em' width='1em' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 1rem center",
                backgroundSize: "1em"
            }}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
