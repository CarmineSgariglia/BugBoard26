interface StatusBadgeProps {
    text: string;
    color: string;
    glow?: boolean;
    className?: string;
}

/**
 * A small status indicator: colored dot + text label.
 *
 * @param text   - The label displayed next to the dot (e.g. "Active", "Open").
 * @param color  - A Tailwind color token WITHOUT the prefix, e.g. "emerald-400", "red-500", "neutral-500".
 * @param glow   - If true, adds a soft colored shadow around the dot (default: false).
 */
export function StatusBadge({ text, color, glow = false, className = "" }: StatusBadgeProps) {
    return (
        <div className={`flex items-center gap-2 text-${color} ${className}`}>
            <div
                className="w-2 h-2 rounded-full bg-current"
                style={glow ? { boxShadow: `0 0 8px currentColor` } : undefined}
            />
            <span className="text-sm">
                {text}
            </span>
        </div>
    );
}
