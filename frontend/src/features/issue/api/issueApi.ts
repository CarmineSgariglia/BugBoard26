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
  return updateIssueApi(issueId, payload);
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
    `/issues/${issueId}/subscriptions/me`,
    withRequestOptions({}, options),
  );
  return data;
}

export async function listIssueUpdatesApi(
  issueId: string | number,
  options?: RequestOptions,
): Promise<IssueUpdate[]> {
  const { data } = await apiClient.get<IssueUpdate[]>(
    `/issues/${issueId}/events`,
    withRequestOptions({}, options),
  );
  return data;
}

export function getIssueUpdatesStreamUrl(issueId: string | number): string {
  return `${apiBaseUrl}/issues/${issueId}/events/stream`;
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

    const { data } = await apiClient.post<IssueUpdate>(`/issues/${issueId}/events`, formData);
    return data;
  }

  const { data } = await apiClient.post<IssueUpdate>(`/issues/${issueId}/events`, {
    message: payload.message,
  });
  return data;
}

export async function assignIssueUsersApi(issueId: number | string, userIds: number[]): Promise<void> {
  for (const userId of userIds) {
    await apiClient.put(`/issues/${issueId}/assignees/${userId}`);
  }
}

export async function unassignIssueUsersApi(issueId: number | string, userIds: number[]): Promise<void> {
  for (const userId of userIds) {
    await apiClient.delete(`/issues/${issueId}/assignees/${userId}`);
  }
}

export async function subscribeToIssueApi(issueId: number | string): Promise<void> {
  await apiClient.put(`/issues/${issueId}/subscriptions/me`);
}

export async function unsubscribeFromIssueApi(issueId: number | string): Promise<void> {
  await apiClient.delete(`/issues/${issueId}/subscriptions/me`);
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
