import { PRIORITIES } from "../../utils/issueConstants";

interface PrioritySelectorProps {
    value: string;
    onChange: (value: string) => void;
}

export function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-400 capitalize tracking-wide">
                Priority
            </label>
            <div className="flex bg-[#0D0D12]/50 border border-white/10 rounded-lg p-1 w-full sm:w-fit">
                {PRIORITIES.map((p) => {
                    const isActive = value === p.value;
                    return (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() => onChange(p.value)}
                            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-medium rounded-md transition-all ${isActive
                                ? "bg-[#1A1D24] text-white shadow-sm border border-white/10"
                                : "text-neutral-500 hover:text-white hover:bg-white/5 border border-transparent"
                                }`}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
