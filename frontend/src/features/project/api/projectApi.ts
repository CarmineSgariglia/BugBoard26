import apiClient from "@shared/api/core/client";
import { withRequestOptions } from "@shared/api/core/config";
import type { RequestOptions } from "@shared/api";
import type { CreateIssuePayload, Issue } from "@shared/api/types/issues";
import type {
  CreateProjectPayload,
  ProjectMembership,
  Project,
  ProjectSubscriptionState,
  UpdateProjectPayload,
} from "@shared/api/types/projects";

export async function listProjectsApi(search?: string, options?: RequestOptions): Promise<Project[]> {
  const params = search ? { q: search } : undefined;
  const { data } = await apiClient.get<Project[]>(
    "/projects",
    withRequestOptions({ params }, options),
  );
  return data;
}

export async function getProjectApi(
  projectId: string | number,
  options?: RequestOptions,
): Promise<Project> {
  const { data } = await apiClient.get<Project>(
    `/projects/${projectId}`,
    withRequestOptions({}, options),
  );
  return data;
}

export async function createProjectApi(payload: CreateProjectPayload): Promise<Project> {
  const { data } = await apiClient.post<Project>("/projects", payload);
  return data;
}

export async function updateProjectApi(
  projectId: number | string,
  payload: UpdateProjectPayload
): Promise<Project> {
  const { data } = await apiClient.patch<Project>(`/projects/${projectId}`, payload);
  return data;
}

export async function deleteProjectApi(projectId: number | string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`);
}

export async function listProjectMembersApi(
  projectId: string | number,
  options?: RequestOptions,
): Promise<ProjectMembership[]> {
  const { data } = await apiClient.get<ProjectMembership[]>(
    `/projects/${projectId}/members`,
    withRequestOptions({}, options),
  );
  return data;
}

export async function getProjectSubscriptionApi(
  projectId: string | number,
  options?: RequestOptions,
): Promise<ProjectSubscriptionState> {
  const { data } = await apiClient.get<ProjectSubscriptionState>(
    `/projects/${projectId}/subscription`,
    withRequestOptions({}, options),
  );
  return data;
}

export async function subscribeToProjectApi(projectId: string | number): Promise<void> {
  await apiClient.post(`/projects/${projectId}/subscription`);
}

export async function unsubscribeFromProjectApi(projectId: string | number): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/subscription`);
}

export async function listProjectIssuesApi(
  projectId: string | number,
  options?: RequestOptions,
): Promise<Issue[]> {
  const { data } = await apiClient.get<Issue[]>(
    `/projects/${projectId}/issues`,
    withRequestOptions({}, options),
  );
  return data;
}

export async function createProjectIssueApi(
  projectId: string | number,
  payload: CreateIssuePayload
): Promise<Issue> {
  const { data } = await apiClient.post<Issue>(`/projects/${projectId}/issues`, payload);
  return data;
}
