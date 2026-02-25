import type { ChangeEvent } from "react";

export interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    bgColor?: string;
    textColor?: string;
    placeholderColor?: string;
    iconColor?: string;
    className?: string;
}

export function SearchBar({
    value,
    onChange,
    placeholder = "Search...",
    bgColor = "bg-white",
    textColor = "text-neutral-900",
    placeholderColor = "placeholder:text-neutral-400",
    iconColor = "text-neutral-900",
    className = "",
}: SearchBarProps) {

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <div className={`flex items-center rounded-full px-4 py-3 shadow-md ${bgColor} ${className}`}>
            <input
                type="text"
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className={`flex-1 bg-transparent outline-none w-full text-base ${textColor} ${placeholderColor}`}
            />
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`ml-2 flex-shrink-0 ${iconColor}`}
            >
                <path
                    d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
}
