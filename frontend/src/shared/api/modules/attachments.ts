import apiClient from "../core/client";
import type { IssueAttachment } from "../types/issues";

export async function uploadAttachmentApi(
  file: File,
  issueId: number,
  message?: string
): Promise<IssueAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("issueId", String(issueId));
  if (message) formData.append("message", message);
  const { data } = await apiClient.post<IssueAttachment>("/attachments", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listAttachmentsApi(params: {
  issueId?: number;
  updateId?: number;
}): Promise<IssueAttachment[]> {
  const { data } = await apiClient.get<IssueAttachment[]>("/attachments", { params });
  return data;
}

export async function deleteAttachmentApi(attachmentId: number): Promise<void> {
  await apiClient.delete(`/attachments/${attachmentId}`);
}
