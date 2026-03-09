import {
    FiArrowDown,
    FiMinus,
    FiArrowUp,
    FiAlertCircle
} from "react-icons/fi";

interface PriorityProps {
    level: string; // "LOW", "MEDIUM", "HIGH", "URGENT"
    className?: string;
}

export function Priority({ level, className = "" }: PriorityProps) {
    const getPriorityConfig = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case "URGENT":
                return {
                    label: "URGENT",
                    textCol: "text-rose-500",
                    border: "border-rose-500/20",
                    bg: "bg-rose-500/10",
                    Icon: FiAlertCircle
                };
            case "HIGH":
                return {
                    label: "HIGH",
                    textCol: "text-orange-500",
                    border: "border-orange-500/20",
                    bg: "bg-orange-500/10",
                    Icon: FiArrowUp
                };
            case "MEDIUM":
                return {
                    label: "MEDIUM",
                    textCol: "text-yellow-500",
                    border: "border-yellow-500/20",
                    bg: "bg-yellow-500/10",
                    Icon: FiMinus
                };
            case "LOW":
                return {
                    label: "LOW",
                    textCol: "text-blue-500",
                    border: "border-blue-500/20",
                    bg: "bg-blue-500/10",
                    Icon: FiArrowDown
                };
            default:
                return {
                    label: priority || "UNKNOWN",
                    textCol: "text-neutral-400",
                    border: "border-neutral-800",
                    bg: "bg-white/5",
                    Icon: FiMinus
                };
        }
    };

    const { Icon, label, textCol, border, bg } = getPriorityConfig(level);

    return (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${border} ${textCol} ${bg} tracking-widest ${className}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
        </div>
    );
}
