/*
    This component is used to display the profile header of the user.
    It is used in the ProfileSettingsSection component.
*/

import { useRef } from "react";
import { MdOutlineFileUpload } from "react-icons/md";
import { HiOutlineUser } from "react-icons/hi2";

interface ProfileHeaderProps {
    avatarUrl?: string;
    title: string;
    subtitle: string;
    onImageSelect?: (file: File) => void;
    isUploading?: boolean;
    mode?: "edit" | "view";
    className?: string;
}

export function ProfileHeader({ avatarUrl, title, subtitle, onImageSelect, isUploading, mode = "edit", className = "" }: ProfileHeaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isViewMode = mode === "view";

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImageSelect?.(e.target.files[0]);
            e.target.value = "";
        }
    };

    return (
        <div className={`flex flex-col items-center pt-10 pb-6 px-8 text-center ${className}`.trim()}>
            {isViewMode ? (
                <div className="h-[72px] w-[72px] rounded-full bg-blue-500/10 flex items-center justify-center mb-5 border border-blue-500/20">
                    <HiOutlineUser size={32} className="text-white/70" />
                </div>
            ) : (
                <div
                    className="relative h-[72px] w-[72px] rounded-full bg-[#fca5a5] flex items-center justify-center overflow-hidden mb-5 shadow-lg border-[3px] border-[#1A1D24]/80 group cursor-pointer transition-transform hover:scale-105"
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    title="Change profile picture"
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                        <MdOutlineFileUpload size={40} className="text-black/40" />
                    )}

                    <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        {isUploading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <MdOutlineFileUpload size={40} className="text-white" />
                        )}
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </div>
            )}
            <h1 className="text-xl font-bold text-white mb-1.5 tracking-tight">{title}</h1>
            <p className="text-sm-p-6 text-neutral-400 text-center max-w-sm">{subtitle}</p>
        </div>
    );
}
