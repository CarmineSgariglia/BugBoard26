import type { ReactNode } from "react";
import projectLogo from "../../assets/LogoBugBoard26-Project.webp";
import { BaseFolderCard } from "./BaseFolderCard";

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

    return (
        <BaseFolderCard color={color} onClick={onClick} className="flex-col p-5">
            {/* Top Section: Icon */}
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/25 shadow-sm inner-shadow">
                {icon}
            </div>

            {/* Middle Section: Texts */}
            <div className="flex-1 flex flex-col justify-end">
                <h3 className="mb-2 text-2xl font-bold tracking-tight text-white line-clamp-1 ">
                    {title}
                </h3>
                <p className="text-sm font-medium text-white/80 line-clamp-2 leading-relaxed ">
                    {description}
                </p>
            </div>

            {/* Divider */}
            <div className="my-5 h-[1px] w-full bg-white/20" />

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
                <div className="rounded-full bg-black/15 px-3 py-1 text-xs font-semibold tracking-wide text-white/95 backdrop-blur-sm">
                    {date}
                </div>
            </div>
        </BaseFolderCard>
    );
}
