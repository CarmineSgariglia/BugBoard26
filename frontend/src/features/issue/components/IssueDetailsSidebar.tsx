import { useState } from "react";
import { FiEdit2 } from "react-icons/fi";

import type { Issue, IssueAssignee } from "@shared/api/types/issues";
import { Avatar } from "@shared/ui/Avatar";
import { Priority } from "@shared/ui/Priority";
import { ScrollComponent } from "@shared/ui/ScrollComponent";
import { SidebarButton } from "@shared/ui/SidebarButton";
import { StatusBadge } from "@shared/ui/StatusBadge";
import { Tag } from "@shared/ui/Tag";
import { SidebarCard } from "@widgets/layout/SidebarCard";
import { SidebarMembersSection } from "@widgets/layout/SidebarMembersSection";

interface IssueDetailsSidebarProps {
  issue: Issue;
  isAdmin?: boolean;
  isAssigned?: boolean;
  assignees?: IssueAssignee[];
  onEditClick?: () => void;
  onManageMembersClick?: () => void;
}

export function IssueDetailsSidebar({
  issue,
  isAdmin,
  isAssigned,
  assignees,
  onEditClick,
  onManageMembersClick,
}: IssueDetailsSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const description = issue.description || "";
  const words = description.split(/\s+/);
  const isLongDescription = words.length > 256;
  const displayDescription =
    isExpanded || !isLongDescription ? description : `${words.slice(0, 256).join(" ")}...`;

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "DONE":
        return "emerald-500";
      case "IN_PROGRESS":
        return "blue-500";
      case "TODO":
        return "orange-500";
      case "CANCELLED":
        return "rose-500";
      default:
        return "neutral-400";
    }
  };

  return (
    <SidebarCard>
      <div className="flex flex-row gap-8 items-center justify-between">
        <SidebarCard.Section title="Status" className="items-center">
          <StatusBadge
            text={issue.status.replace("_", " ")}
            color={getStatusColor(issue.status)}
            variant="pill"
            glow
          />
        </SidebarCard.Section>

        <SidebarCard.Section title="Type" className="items-center">
          <Tag text={issue.type} />
        </SidebarCard.Section>

        <SidebarCard.Section title="Priority" className="items-center">
          <Priority level={issue.priority} />
        </SidebarCard.Section>
      </div>

      <SidebarCard.Section title="Description">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-neutral-400 leading-relaxed break-words">
            <ScrollComponent maxHeight="max-h-[150px]">{displayDescription}</ScrollComponent>
          </p>
          {isLongDescription && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors w-fit"
            >
              {isExpanded ? "Show Less" : "Read More"}
            </button>
          )}
        </div>
      </SidebarCard.Section>

      <SidebarCard.Section title="Reporter">
        <div className="flex items-center gap-3">
          <Avatar name={issue.reporter?.username || "Unknown"} src={issue.reporter?.profileImg} size="md" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white">
              {issue.reporter?.username || "Unknown Reporter"}
            </span>
            <span className="text-xs text-neutral-500">
              {issue.reporter?.email || "No email available"}
            </span>
          </div>
        </div>
      </SidebarCard.Section>

      <SidebarCard.Section title="Tags">
        <div className="flex flex-wrap gap-2">
          {issue.tags && issue.tags.length > 0 ? (
            issue.tags.map((tag) => (
              <Tag
                key={tag.tagId}
                text={tag.name.toUpperCase()}
                textColor="text-blue-500"
                borderColor="border-blue-500/20"
                className="bg-blue-500/5"
              />
            ))
          ) : (
            <span className="text-xs text-neutral-600 italic">No tags</span>
          )}
        </div>
      </SidebarCard.Section>

      <SidebarMembersSection
        title="Assigned To"
        members={assignees || issue.assignees}
        isAdmin={isAdmin}
        onActionClick={onManageMembersClick}
        max={5}
        adminLabel="Manage members"
        userLabel="View members"
        emptyText="No one assigned"
      />

      <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
        {(isAssigned || isAdmin) && (
          <SidebarButton
            icon={<FiEdit2 size={14} />}
            label="Edit Issue"
            onClick={onEditClick}
            variant="primary"
          />
        )}
      </div>
    </SidebarCard>
  );
}
