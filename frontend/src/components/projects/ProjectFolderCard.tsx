import type { ReactNode } from "react";
import projectLogo from "../../assets/LogoBugBoard26-Project.webp";
import { BaseFolderCard } from "./BaseFolderCard";
import { getContrastColor } from "../../utils/color";
import { useMemo } from "react";

export interface ProjectFolderCardProps {
    color: string;
    title: string;
    description: string;
    icon: ReactNode;
    date: string;
    authorImageUrl?: string | null;
    onClick?: () => void;
}

export function ProjectFolderCard({
    color,
    title,
    description,
    icon,
    date,
    authorImageUrl,
    onClick,
}: ProjectFolderCardProps) {

    const styles = useMemo(() => ({ // POTREMMO ANDARE AD EFFETTUARE UN'ASSEGNAZIONE (?)
        textMain: getContrastColor(color, 1),
        textSub: getContrastColor(color, 0.75),
        textPill: getContrastColor(color, 0.9),
        divider: getContrastColor(color, 0.075),
        colorIconBg: getContrastColor(color, 0.15),
    }), [color]);

    return (
        <BaseFolderCard color={color} onClick={onClick} className="flex-col p-5">
            {/* Top Section: Icon */}
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl shadow-sm inner-shadow" style={{ backgroundColor: styles.colorIconBg, color: styles.textMain }}>
                {icon}
            </div>

            {/* Middle Section: Texts */}
            <div className="flex-1 flex flex-col justify-end">
                <h3 className="mb-2 text-2xl font-bold tracking-tight line-clamp-1" style={{ color: styles.textMain }}>
                    {title}
                </h3>
                <p className="text-sm font-medium line-clamp-2 leading-relaxed h-[45px]" style={{ color: styles.textSub }}>
                    {description}
                </p>
            </div>

            {/* Divider */}
            <div className="my-5 h-[1px] w-full" style={{ backgroundColor: styles.divider }} />

            {/* Footer Section: Author & Date */}
            <div className="flex items-center justify-between">
                {/* Author Avatar inside BugBoard Logo */}
                <div className="relative flex h-14 w-14 items-center justify-center">
                    {/* BugBoard Logo (Backdrop) */}
                    <img
                        src={projectLogo}
                        alt="Platform"
                        className="absolute inset-0 h-full w-full object-contain opacity-30 drop-shadow-md"
                    />
                    {/* User Avatar (Foreground) */}
                    <div className="relative z-10 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-[#0D0D12] shadow-sm">
                        {authorImageUrl ? (
                            <img src={authorImageUrl} alt="Author" className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full bg-black/30" />
                        )}
                    </div>
                </div>

                {/* Date Pill */}
                <div className="rounded-full bg-black/15 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm" style={{ color: styles.textSub }}>
                    {date}
                </div>
            </div>
        </BaseFolderCard>
    );
}
