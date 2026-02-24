import type { ReactNode } from "react";

export interface ProjectFolderCardProps {
    color: string;
    title: string;
    description: string;
    icon: ReactNode;
    date: string;
    authorImageUrl?: string;
    onClick?: () => void;
}

export function ProjectFolderCard({
    color,
    title,
    description,
    icon,
    date,
    authorImageUrl,
    onClick
}: ProjectFolderCardProps) {
    return (
        <button
            onClick={onClick}
            className="group relative w-full text-left outline-none transition-transform hover:-translate-y-1 hover:shadow-2xl focus:ring-2 focus:ring-white/20 rounded-2xl"
        >
            {/* The Back Tab (Folder Tab) */}
            <div
                className="absolute left-0 top-0 h-8 w-[40%] rounded-t-xl transition-colors"
                style={{
                    backgroundColor: color,
                    filter: "brightness(0.75)", // Darken the tab to simulate physical depth
                }}
            />

            {/* The Light Lip (Middle Layer Highlight) */}
            <div
                className="absolute left-0 right-0 top-[10px] h-6 rounded-t-2xl transition-colors z-0"
                style={{
                    backgroundColor: color,
                    filter: "brightness(1.15)", // Lighter version of the base color
                }}
            />

            {/* The Main Front Body of the Folder */}
            <div
                className="relative z-10 mt-[14px] flex flex-col rounded-2xl border border-white/20 p-5 shadow-xl transition-colors min-h-[220px]"
                style={{ backgroundColor: color }}
            >
                {/* Top Section: Icon */}
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/25 shadow-sm inner-shadow">
                    {icon}
                </div>

                {/* Middle Section: Texts */}
                <div className="flex-1 flex flex-col justify-end">
                    <h3 className="mb-2 text-2xl font-bold tracking-tight text-white line-clamp-1">
                        {title}
                    </h3>
                    <p className="text-sm font-medium text-white/80 line-clamp-2 leading-relaxed">
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
                            src="/src/assets/LogoBugBoard26-Project.webp"
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
            </div>
        </button>
    );
}
