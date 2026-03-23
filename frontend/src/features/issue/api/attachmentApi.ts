import apiClient from "@shared/api/core/client";
import type { IssueAttachment } from "@shared/api/types/issues";

type AttachmentTarget =
  | { issueId: number; eventId?: never }
  | { issueId: number; eventId: number };

export async function uploadAttachmentApi(
  file: File,
  target: AttachmentTarget,
  message?: string
): Promise<IssueAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  if (message) formData.append("message", message);
  const endpoint =
    "eventId" in target
      ? `/issues/${target.issueId}/events/${target.eventId}/attachments`
      : `/issues/${target.issueId}/attachments`;
  const { data } = await apiClient.post<IssueAttachment>(endpoint, formData);
  return data;
}

export async function listAttachmentsApi(issueId: number): Promise<IssueAttachment[]> {
  const { data } = await apiClient.get<IssueAttachment[]>(`/issues/${issueId}/attachments`);
  return data;
}

export async function deleteAttachmentApi(issueId: number, attachmentId: number): Promise<void> {
  await apiClient.delete(`/issues/${issueId}/attachments/${attachmentId}`);
}
