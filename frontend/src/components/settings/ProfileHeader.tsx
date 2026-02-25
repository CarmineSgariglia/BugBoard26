import { useRef } from "react";
import { MdOutlineFileUpload } from "react-icons/md";


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
                    <MdOutlineFileUpload size={40} className="text-black/40" />
                )}

                {/* Hover Overlay & Uploading Spinner */}
                <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isUploading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <MdOutlineFileUpload size={40} className="text-black/40" />
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
