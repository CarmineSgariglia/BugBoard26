/*
    SearchBar component
*/

import type { ChangeEvent } from "react";
import { FaSearch } from "react-icons/fa";


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
            <FaSearch size={18} className={`ml-2 flex-shrink-0 ${iconColor}`} />
        </div>
    );
}
