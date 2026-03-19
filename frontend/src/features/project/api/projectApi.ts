import apiClient from "@shared/api/core/client";
import type { CreateIssuePayload, Issue } from "@shared/api/types/issues";
import type {
  CreateProjectPayload,
  ProjectMembership,
  Project,
  ProjectSubscriptionState,
  UpdateProjectPayload,
} from "@shared/api/types/projects";

export async function listProjectsApi(search?: string): Promise<Project[]> {
  const params = search ? { q: search } : undefined;
  const { data } = await apiClient.get<Project[]>("/projects", { params });
  return data;
}

export async function getProjectApi(projectId: string | number): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/projects/${projectId}`);
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

export async function listProjectMembersApi(projectId: string | number): Promise<ProjectMembership[]> {
  const { data } = await apiClient.get<ProjectMembership[]>(`/projects/${projectId}/members`);
  return data;
}

export async function getProjectSubscriptionApi(
  projectId: string | number
): Promise<ProjectSubscriptionState> {
  const { data } = await apiClient.get<ProjectSubscriptionState>(
    `/projects/${projectId}/subscription`
  );
  return data;
}

export async function subscribeToProjectApi(projectId: string | number): Promise<void> {
  await apiClient.post(`/projects/${projectId}/subscription`);
}

export async function unsubscribeFromProjectApi(projectId: string | number): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/subscription`);
}

export async function listProjectIssuesApi(projectId: string | number): Promise<Issue[]> {
  const { data } = await apiClient.get<Issue[]>(`/projects/${projectId}/issues`);
  return data;
}

export async function createProjectIssueApi(
  projectId: string | number,
  payload: CreateIssuePayload
): Promise<Issue> {
  const { data } = await apiClient.post<Issue>(`/projects/${projectId}/issues`, payload);
  return data;
}
