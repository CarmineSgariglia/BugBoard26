import { useRef } from "react";

interface ProfileHeaderProps {
    avatarUrl?: string;
    title: string;
    subtitle: string;
    onImageSelect?: (file: File) => void;
    isUploading?: boolean;
}

export function ProfileHeader({ avatarUrl, title, subtitle, onImageSelect, isUploading }: ProfileHeaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImageSelect?.(e.target.files[0]);
            // Reset input so the same file can be selected again if needed
            e.target.value = "";
        }
    };

    return (
        <div className="flex flex-col items-center pt-10 pb-6 px-8 text-center">
            <div
                className="relative h-[72px] w-[72px] rounded-full bg-[#fca5a5] flex items-center justify-center overflow-hidden mb-5 shadow-lg border-[3px] border-[#1A1D24]/80 group cursor-pointer transition-transform hover:scale-105"
                onClick={() => !isUploading && fileInputRef.current?.click()}
                title="Change profile picture"
            >
                {/* Image or Placeholder */}
                {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                    // Default avatar placeholder or svg
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black/40">
                        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor" />
                        <path d="M12.0002 14.5C6.99023 14.5 2.91023 17.86 2.91023 22C2.91023 22.28 3.13023 22.5 3.41023 22.5H20.5902C20.8702 22.5 21.0902 22.28 21.0902 22C21.0902 17.86 17.0102 14.5 12.0002 14.5Z" fill="currentColor" />
                    </svg>
                )}

                {/* Hover Overlay & Uploading Spinner */}
                <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isUploading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white drop-shadow-md">
                            <path d="M3 16V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V16M16 8L12 4M12 4L8 8M12 4V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </div>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>
            <h1 className="text-xl font-bold text-white mb-1.5 tracking-tight">{title}</h1>
            <p className="text-xs font-medium text-neutral-400">{subtitle}</p>
        </div>
    );
}
