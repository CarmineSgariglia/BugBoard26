import apiClient from "../core/client";
import type { Issue, IssueUpdate, UpdateIssuePayload } from "../types/issues";

export async function updateIssueDetailsApi(
  issueId: number | string,
  payload: UpdateIssuePayload
): Promise<Issue> {
  const { data } = await apiClient.patch<Issue>(`/issues/${issueId}/details/`, payload);
  return data;
}

export async function getIssueApi(issueId: string | number): Promise<Issue> {
  const { data } = await apiClient.get<Issue>(`/issues/${issueId}/`);
  return data;
}

export async function updateIssueApi(issueId: number | string, payload: UpdateIssuePayload): Promise<Issue> {
  const { data } = await apiClient.patch<Issue>(`/issues/${issueId}/`, payload);
  return data;
}

export async function listIssueUpdatesApi(issueId: string | number): Promise<IssueUpdate[]> {
  const { data } = await apiClient.get<IssueUpdate[]>(`/issues/${issueId}/updates/`);
  return data;
}
