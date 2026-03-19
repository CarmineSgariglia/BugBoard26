import axios from "axios";
import type { QueryClient } from "@tanstack/react-query";

export function revokeProjectAccess(
  queryClient: QueryClient,
  projectId: number,
  currentProjects?: Array<{ projectId: number }>,
) {
  queryClient.setQueryData(
    ["projects"],
    (cachedProjects: Array<{ projectId: number }> | undefined) =>
      (currentProjects ?? cachedProjects ?? []).filter((project) => project.projectId !== projectId),
  );

  queryClient.removeQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "project" &&
      String(query.queryKey[1]) === String(projectId),
  });
}

export function invalidateProjectAccessQueries(
  queryClient: QueryClient,
  projectId: number,
  issueId?: number | null,
) {
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "project" &&
      String(query.queryKey[1]) === String(projectId),
  });

  if (issueId != null) {
    void queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "issue" &&
        String(query.queryKey[1]) === String(issueId),
    });
  }
}

export function isProjectAccessRevokedError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  return status === 403 || status === 404;
}
