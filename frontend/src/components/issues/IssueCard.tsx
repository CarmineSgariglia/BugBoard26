import { Tag } from "../ui/Tag";
import { type Issue } from "../../services/api";

interface IssueCardProps {
    issue: Issue;
    onClick?: () => void;
}

export function IssueCard({ issue, onClick }: IssueCardProps) {
    const dateStr = new Date(issue.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    // Simple mapping for status colors
    const getStatusStyles = (status: string) => {
        switch (status.toUpperCase()) {
            case "DONE":
                return { text: "DONE", bg: "bg-emerald-500/10", border: "border-emerald-500/20", textCol: "text-emerald-500" };
            case "IN_PROGRESS":
                return { text: "IN PROGRESS", bg: "bg-blue-500/10", border: "border-blue-500/20", textCol: "text-blue-500" };
            case "TODO":
            default:
                return { text: "TODO", bg: "bg-orange-500/10", border: "border-orange-500/20", textCol: "text-orange-500" };
        }
    };

    const getPriorityStyles = (priority: string) => {
        switch (priority.toUpperCase()) {
            case "URGENT":
                return { text: "URGENT", textCol: "text-rose-500", border: "border-rose-500/20" };
            case "HIGH":
                return { text: "HIGH", textCol: "text-orange-500", border: "border-orange-500/20" };
            case "MEDIUM":
                return { text: "MEDIUM", textCol: "text-yellow-500", border: "border-yellow-500/20" };
            case "LOW":
                return { text: "LOW", textCol: "text-blue-500", border: "border-blue-500/20" };
            default:
                return { text: priority, textCol: "text-neutral-400", border: "border-neutral-800" };
        }
    };

    const statusStyle = getStatusStyles(issue.status);
    const priorityStyle = getPriorityStyles(issue.priority);

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col gap-4 p-6 rounded-2xl border-l-2 border-l-white  border border-white/5 bg-[#121620]/40 hover:bg-[#1E2332]/60 hover:border-white/10 transition-all cursor-pointer overflow-hidden min-h-[155px]"
        >
            {/* Left accent hover effect */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity ${statusStyle.textCol.replace("text-", "bg-")}`} />

            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">
                        #{issue.issueId} - {issue.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${statusStyle.bg} ${statusStyle.textCol} ${statusStyle.border} border`}>
                        {statusStyle.text}
                    </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-medium whitespace-nowrap">
                    {dateStr}
                </span>
            </div>

            <p className="text-sm text-neutral-400 line-clamp-2 leading-relaxed">
                {issue.description}
            </p>

            <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Category (represented by type in our API for now) */}
                    <Tag
                        text={issue.type.toUpperCase()}
                        textColor="text-[#EF476F]"
                        borderColor="border-[#EF476F]/20"
                        className="bg-[#EF476F]/5"
                    />

                    {/* Placeholder tags for visual match, actual tags would come from metadata or keywords */}
                    <Tag
                        text="#API"
                        textColor="text-[#5671F6]"
                        borderColor="border-[#5671F6]/20"
                        className="bg-[#5671F6]/5"
                    />
                </div>

                <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${priorityStyle.border} ${priorityStyle.textCol} tracking-widest`}>
                    {priorityStyle.text}
                </div>
            </div>
        </div>
    );
}
