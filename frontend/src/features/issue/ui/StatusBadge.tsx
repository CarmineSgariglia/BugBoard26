interface StatusBadgeProps {
    text: string;
    color: string;
    glow?: boolean;
    variant?: "default" | "pill";
    className?: string;
}

export function StatusBadge({
    text,
    color,
    glow = false,
    variant = "default",
    className = ""
}: StatusBadgeProps) {

    // Se è in modalità pill, aggiungiamo bordi, sfondo semi-trasparente e padding
    const pillStyles = variant === "pill"
        ? `px-2 py-0.5 rounded-md border border-${color}/20 bg-${color}/10 text-[10px] font-bold uppercase tracking-wider`
        : "text-sm";

    return (
        <div className={`flex items-center gap-2 text-${color} ${pillStyles} ${className}`}>
            <div
                className="w-1.5 h-1.5 rounded-full bg-current"
                style={glow ? { boxShadow: `0 0 8px currentColor` } : undefined}
            />
            <span>
                {text}
            </span>
        </div>
    );
}
