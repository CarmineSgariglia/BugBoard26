import apiClient from "../core/client";
import type { IssueAttachment } from "../types/issues";

type AttachmentTarget =
  | { issueId: number; updateId?: never }
  | { updateId: number; issueId?: never };

export async function uploadAttachmentApi(
  file: File,
  target: AttachmentTarget,
  message?: string
): Promise<IssueAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  if ("issueId" in target) formData.append("issueId", String(target.issueId));
  if ("updateId" in target) formData.append("updateId", String(target.updateId));
  if (message) formData.append("message", message);
  const { data } = await apiClient.post<IssueAttachment>("/attachments", formData);
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