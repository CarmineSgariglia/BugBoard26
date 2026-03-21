import apiClient, { apiBaseUrl } from "@shared/api/core/client";
import { withRequestOptions } from "@shared/api/core/config";
import type { RequestOptions } from "@shared/api";
import type {
  Issue,
  IssueSubscriptionState,
  IssueSuggestion,
  IssueUpdate,
  UpdateIssuePayload,
} from "@shared/api/types/issues";

export async function updateIssueDetailsApi(
  issueId: number | string,
  payload: UpdateIssuePayload
): Promise<Issue> {
  const { data } = await apiClient.patch<Issue>(`/issues/${issueId}/details`, payload);
  return data;
}

export async function updateIssueApi(issueId: number | string, payload: UpdateIssuePayload): Promise<Issue> {
  const { data } = await apiClient.patch<Issue>(`/issues/${issueId}`, payload);
  return data;
}

export async function getIssueApi(
  issueId: string | number,
  options?: RequestOptions,
): Promise<Issue> {
  const { data } = await apiClient.get<Issue>(
    `/issues/${issueId}`,
    withRequestOptions({}, options),
  );
  return data;
}

export async function getIssueSubscriptionApi(
  issueId: string | number,
  options?: RequestOptions,
): Promise<IssueSubscriptionState> {
  const { data } = await apiClient.get<IssueSubscriptionState>(
    `/issues/${issueId}/subscription`,
    withRequestOptions({}, options),
  );
  return data;
}

export async function listIssueUpdatesApi(
  issueId: string | number,
  options?: RequestOptions,
): Promise<IssueUpdate[]> {
  const { data } = await apiClient.get<IssueUpdate[]>(
    `/issues/${issueId}/updates`,
    withRequestOptions({}, options),
  );
  return data;
}

export function getIssueUpdatesStreamUrl(issueId: string | number): string {
  return `${apiBaseUrl}/issues/${issueId}/updates/stream`;
}

export async function createIssueUpdateApi(
  issueId: number | string,
  payload: { message: string; files?: File[] }
): Promise<IssueUpdate> {
  const hasFiles = Boolean(payload.files && payload.files.length > 0);

  if (hasFiles) {
    const formData = new FormData();
    formData.append("message", payload.message);

    if (payload.files) {
      for (const file of payload.files) {
        formData.append("file", file);
      }
    }

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

export async function subscribeToIssueApi(issueId: number | string): Promise<void> {
  await apiClient.post(`/issues/${issueId}/subscription`);
}

export async function unsubscribeFromIssueApi(issueId: number | string): Promise<void> {
  await apiClient.delete(`/issues/${issueId}/subscription`);
}

export async function listIssueSuggestionsApi(
  issueId: number | string,
  options?: RequestOptions,
): Promise<IssueSuggestion[]> {
  const { data } = await apiClient.get<IssueSuggestion[]>(
    `/issues/${issueId}/suggestions`,
    withRequestOptions({}, options),
  );
  return data;
}
