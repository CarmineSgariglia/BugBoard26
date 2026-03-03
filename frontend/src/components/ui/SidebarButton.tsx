import { type ReactNode } from "react";
import { HiOutlineChevronRight } from "react-icons/hi";

interface SidebarButtonProps {
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    variant?: "default" | "danger" | "primary" | "success";
    className?: string;
}

export function SidebarButton({
    icon,
    label,
    onClick,
    variant = "default",
    className = ""
}: SidebarButtonProps) {

    // Stile base: sfondo scuro, bordi leggeri, transizioni smooth
    const baseStyles = "group flex items-center justify-between p-3 rounded-xl bg-[#1E2332]/40 hover:bg-[#1E2332]/80 border border-white/5 hover:border-white/10 transition-all text-neutral-300 w-full text-left";

    // Colori del testo al passaggio del mouse
    const variants = {
        default: "hover:text-white",
        danger: "hover:text-red-400 hover:bg-red-400/5 hover:border-red-400/20",
        primary: "hover:text-blue-400 hover:bg-blue-400/5 hover:border-blue-400/20",
        success: "hover:text-emerald-400 hover:bg-emerald-400/5 hover:border-emerald-400/20"
    };

    // Colori dell'icona (cambiano insieme al testo nel group-hover)
    const iconColors = {
        default: "text-neutral-500 group-hover:text-white",
        danger: "text-neutral-500 group-hover:text-red-400",
        primary: "text-neutral-500 group-hover:text-blue-400",
        success: "text-neutral-500 group-hover:text-emerald-400"
    };

    return (
        <button
            onClick={onClick}
            className={`${baseStyles} ${variants[variant]} ${className}`}
        >
            <div className="flex items-center gap-3">
                <div className={`${iconColors[variant]} transition-colors`}>
                    {icon}
                </div>
                <span className="text-sm font-medium">{label}</span>
            </div>
            {/* Freccetta che si muove leggermente a destra al passaggio del mouse */}
            <HiOutlineChevronRight className="text-neutral-600 group-hover:translate-x-0.5 group-hover:text-neutral-400 transition-all" size={16} />
        </button>
    );
}
