import { BaseFolderCard } from "./BaseFolderCard";
import { IoMdAdd } from "react-icons/io";


interface CreateProjectCardProps {
    onClick: () => void;
}

export function CreateProjectCard({ onClick }: CreateProjectCardProps) {
    return (
        <BaseFolderCard color="#1b1e2a" onClick={onClick} className="p-4">
            <div className="flex flex-col items-center justify-center w-full h-full min-h-[190px] border-2 border-dashed border-white/20 rounded-xl hover:bg-white/5 hover:border-white/40 transition-colors cursor-pointer">

                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 shadow-sm inner-shadow mb-4 group-hover:bg-white/20 transition-colors">
                    <IoMdAdd size={32} className="text-white opacity-80" />
                </div>

                <span className="text-[#9CA3AF] font-medium text-lg tracking-wide group-hover:text-white transition-colors">
                    Create Project
                </span>

            </div>
        </BaseFolderCard>
    );
}
