interface ProfileHeaderProps {
    avatarUrl?: string;
    title: string;
    subtitle: string;
}

export function ProfileHeader({ avatarUrl, title, subtitle }: ProfileHeaderProps) {
    return (
        <div className="flex flex-col items-center pt-10 pb-6 px-8 text-center">
            <div className="h-[72px] w-[72px] rounded-full bg-[#fca5a5] flex items-center justify-center overflow-hidden mb-5 shadow-lg border-[3px] border-[#1A1D24]/80">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                    // Default avatar placeholder or svg
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black/40">
                        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor" />
                        <path d="M12.0002 14.5C6.99023 14.5 2.91023 17.86 2.91023 22C2.91023 22.28 3.13023 22.5 3.41023 22.5H20.5902C20.8702 22.5 21.0902 22.28 21.0902 22C21.0902 17.86 17.0102 14.5 12.0002 14.5Z" fill="currentColor" />
                    </svg>
                )}
            </div>
            <h1 className="text-xl font-bold text-white mb-1.5 tracking-tight">{title}</h1>
            <p className="text-xs font-medium text-neutral-400">{subtitle}</p>
        </div>
    );
}
