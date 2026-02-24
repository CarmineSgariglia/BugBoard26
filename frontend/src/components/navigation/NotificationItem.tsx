import { GlassButton } from "./GlassButton";

interface NotificationItemProps {
    title: string;
    description: string;
    time: string;
    imageUrl?: string;
    onClick?: () => void;
}

export function NotificationItem({ title, description, time, imageUrl, onClick }: NotificationItemProps) {
    return (
        <GlassButton className="!px-3 !py-2 !items-start gap-3" onClick={onClick}>
            {/* Avatar / Icon Placeholder */}
            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-slate-700"></div>
                )}
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 text-left justify-center min-w-0">
                <span className="text-white font-medium text-sm truncate leading-tight">{title}</span>
                <span className="text-neutral-400 text-xs truncate leading-tight mt-0.5">{description}</span>
            </div>

            {/* Time */}
            <div className="text-neutral-500 text-[11px] whitespace-nowrap ml-2 mt-0.5">
                {time}
            </div>
        </GlassButton>
    );
}
