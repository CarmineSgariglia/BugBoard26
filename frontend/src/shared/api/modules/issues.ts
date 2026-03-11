import apiClient from "../core/client";
import type { Issue, IssueUpdate, UpdateIssuePayload } from "../types/issues";

export async function updateIssueDetailsApi(
  issueId: number | string,
  payload: UpdateIssuePayload
): Promise<Issue> {
  const { data } = await apiClient.patch<Issue>(`/issues/${issueId}/details`, payload);
  return data;
}

export async function getIssueApi(issueId: string | number): Promise<Issue> {
  const { data } = await apiClient.get<Issue>(`/issues/${issueId}`);
  return data;
}

export async function updateIssueApi(issueId: number | string, payload: UpdateIssuePayload): Promise<Issue> {
  const { data } = await apiClient.patch<Issue>(`/issues/${issueId}`, payload);
  return data;
}

export async function listIssueUpdatesApi(issueId: string | number): Promise<IssueUpdate[]> {
  const { data } = await apiClient.get<IssueUpdate[]>(`/issues/${issueId}/updates`);
  return data;
}

export async function createIssueUpdateApi(
  issueId: number | string,
  payload: { message: string; file?: File | null }
): Promise<IssueUpdate> {
  const hasFile = Boolean(payload.file);

  if (hasFile) {
    const formData = new FormData();
    formData.append("message", payload.message);
    if (payload.file) formData.append("file", payload.file);

    const { data } = await apiClient.post<IssueUpdate>(`/issues/${issueId}/updates`, formData);
    return data;
  }

  const { data } = await apiClient.post<IssueUpdate>(`/issues/${issueId}/updates`, {
    message: payload.message,
  });
  return data;
}

export async function assignIssueUsersApi(issueId: number | string, userIds: number[]): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>(`/issues/${issueId}/assign`, { userIds });
  return data;
}

export async function unassignIssueUsersApi(issueId: number | string, userIds: number[]): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>(`/issues/${issueId}/unassign`, { userIds });
  return data;
}