import { Select } from "@shared/ui/Select";

type Props = {
  scope: "ALL" | "YOURS";
  sort: "NEWEST" | "OLDEST";
  onScopeChange: (v: "ALL" | "YOURS") => void;
  onSortChange: (v: "NEWEST" | "OLDEST") => void;
};

export function IssueActivityFilters({ scope, sort, onScopeChange, onSortChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-[120px]">
        <Select
          value={scope}
          onChange={(v) => onScopeChange(v as "ALL" | "YOURS")}
          options={[
            { label: "All", value: "ALL" },
            { label: "Yours", value: "YOURS" },
          ]}
          className="[&>select]:h-10 [&>select]:rounded-xl"
        />
      </div>

      <div className="w-[170px]">
        <Select
          value={sort}
          onChange={(v) => onSortChange(v as "NEWEST" | "OLDEST")}
          options={[
            { label: "Newest first", value: "NEWEST" },
            { label: "Oldest first", value: "OLDEST" },
          ]}
          className="[&>select]:h-10 [&>select]:rounded-xl"
        />
      </div>
    </div>
  );
}
