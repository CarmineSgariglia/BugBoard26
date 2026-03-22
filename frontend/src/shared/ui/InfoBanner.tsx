interface InfoBannerProps {
    message: string;
    className?: string;
}

export function InfoBanner({ message, className = "" }: InfoBannerProps) {
    return (
        <div className={`border-t border-white/10 bg-[#0D1322] px-4 py-4 text-sm text-neutral-300 ${className}`}>
            {message}
        </div>
    );
}
