import type { AuthUser } from "./auth";

export type Tag = {
  tagId: number;
  name: string;
};

export type IssueAssignee = {
  userId: number;
  username: string;
  profileImg?: string | null;
};

export type Issue = {
  issueId: number;
  projectId: number;
  reporterId?: number;
  reporter: AuthUser;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  tags: Tag[];
  assignees: IssueAssignee[];
};

export type IssueAttachment = {
  attachmentId: number;
  updateId: number;
  path: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type IssueImage = {
  issueImageId: number;
  issueId: number;
  path: string;
  url: string;
};

export type UpdateIssuePayload = {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  assigneeIds?: number[];
  tagIds?: number[];
  tagNames?: string[];
  message?: string;
};

export type CreateIssuePayload = {
  title: string;
  description: string;
  type: string;
  priority: string;
  tagNames?: string[];
};

export type IssueUpdate = {
  updateId: number;
  issueId: number;
  actorId: number;
  actorUsername: string;
  eventType: string;
  at: string;
  message: string;
  oldStatus?: string;
  newStatus?: string;
  attachments: IssueAttachment[];
};

export type IssueEventType =
  | "CREATE"
  | "EDIT"
  | "STATUS_CHANGE"
  | "ASSIGN"
  | "UNASSIGN"
  | "COMMENT";

export type CreateIssueUpdatePayload = {
  message: string;
  file?: File | null;
};
