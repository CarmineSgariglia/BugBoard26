export const projectQueryKeys = {
  all: ["projects"] as const,
  detail: (projectId: string | number) => ["project", projectId] as const,
  members: (projectId: string | number) => ["project", projectId, "members"] as const,
  issues: (projectId: string | number) => ["project", projectId, "issues"] as const,
};
