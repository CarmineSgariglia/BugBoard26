import { HiOutlineCheckCircle } from "react-icons/hi";
import { Button } from "../ui/Button";

interface NotificationItemProps {
    title: string;
    description: string;
    time: string;
    imageUrl?: string;
    unread?: boolean;
    onClick?: () => void;
    onMarkRead?: () => void;
}

export function NotificationItem({ title, description, time, imageUrl, unread = false, onClick, onMarkRead }: NotificationItemProps) {
    return (
        <Button
            variant="glass"
            className={`!px-3 !py-2 !items-start gap-3 w-full border ${unread ? "border-cyan-300/40 bg-cyan-500/5" : "border-transparent"} !h-auto !rounded-2xl`}
            onClick={onClick}
        >
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

            {/* Time + Mark Read */}
            <div className="flex flex-col items-end gap-1 ml-2 mt-0.5 shrink-0">
                <span className="text-neutral-500 text-[11px] whitespace-nowrap">
                    {time}
                </span>
                {unread && onMarkRead && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead();
                        }}
                        className="text-cyan-400/60 hover:text-cyan-300 transition-colors"
                        title="Mark as read"
                    >
                        <HiOutlineCheckCircle size={18} />
                    </button>
                )}
            </div>
        </Button>
    );
}
