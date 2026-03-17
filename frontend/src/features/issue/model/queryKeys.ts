export const issueQueryKeys = {
  detail: (issueId: string | number) => ["issue", issueId] as const,
  updates: (issueId: string | number) => ["issue", issueId, "updates"] as const,
};
