export interface TagProps {
    text: string;
    textColor?: string;
    borderColor?: string;
    className?: string;
}

export function Tag({
    text,
    textColor = "text-[#4A72FF]",   // Default Theme Blue text
    borderColor = "border-[#4A72FF]/20", // Default Theme Blue border
    className = "",
}: TagProps) {
    return (
        <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 border ${textColor} ${borderColor} ${className}`}
        >
            {text}
        </span>
    );
}
