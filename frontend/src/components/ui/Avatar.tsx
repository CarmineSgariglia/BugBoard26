import { resolveMediaUrl } from "../../services/api";

interface AvatarProps {
    name: string;
    src?: string | null;
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}

export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
    const sizeClasses = {
        xs: "w-6 h-6 text-[8px]",
        sm: "w-8 h-8 text-[10px]",
        md: "w-10 h-10 text-xs",
        lg: "w-12 h-12 text-sm",
    };

    return (
        <div
            className={`relative inline-block rounded-full ring-2 ring-[#0D0D12] bg-[#1E2332] overflow-hidden flex-shrink-0 ${sizeClasses[size]} ${className}`}
            title={name}
        >
            {src ? (
                <img
                    className="h-full w-full object-cover"
                    src={resolveMediaUrl(src)}
                    alt={name}
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-white/70">
                    {name.slice(0, 1).toUpperCase()}
                </div>
            )}
        </div>
    );
}
