import { resolveMediaUrl, type AuthUser } from "../../services/api";

interface AvatarTriggerProps {
    user: AuthUser | null;
    onClick: () => void;
}

export function AvatarTrigger({ user, onClick }: AvatarTriggerProps) {
    return (
        <button
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 outline-none hover:ring-2 hover:ring-white/20 transition-all flex-shrink-0 flex items-center justify-center overflow-hidden"
            onClick={onClick}
        >
            {user?.profileImg ? (
                <img
                    src={resolveMediaUrl(user.profileImg)}
                    alt={user.username}
                    className="h-full w-full object-cover"
                />
            ) : (
                <span className="text-[10px] font-bold text-white/60">
                    {(user?.username ?? "U").slice(0, 1).toUpperCase()}
                </span>
            )}
        </button>
    );
}
