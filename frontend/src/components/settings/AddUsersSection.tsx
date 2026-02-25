import { GlassCard } from "../ui/GlassCard";
import { TiUserAdd } from "react-icons/ti";


export function AddUsersSection() {
    return (
        <GlassCard className="w-full flex flex-col items-center justify-center p-14 border-dashed border-2 border-white/20">
            <TiUserAdd size={48} className="text-white/40 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Add New Users</h2>
            <p className="text-center text-sm text-neutral-400">
                This section is still under development.
            </p>
        </GlassCard>
    );
}
