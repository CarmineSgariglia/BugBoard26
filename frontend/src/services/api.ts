import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let csrfPromise: Promise<void> | null = null;

function readCookie(name: string): string {
  const escapedName = name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function ensureCsrfToken(): Promise<void> {
  if (readCookie("csrftoken")) {
    return;
  }

  if (!csrfPromise) {
    csrfPromise = api
      .get("/auth/csrf", { skipAuthRefresh: true } as RetryableRequestConfig)
      .then(() => undefined)
      .finally(() => {
        csrfPromise = null;
      });
  }

  await csrfPromise;
}

api.interceptors.request.use(async (config) => {
  const requestConfig = config as RetryableRequestConfig;
  const method = (config.method ?? "get").toUpperCase();
  const requiresCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE";
  if (accessToken) {
    requestConfig.headers = requestConfig.headers ?? {};
    requestConfig.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (!requiresCsrf) return requestConfig;

  await ensureCsrfToken();

  const csrfToken = readCookie("csrftoken");
  if (csrfToken) {
    requestConfig.headers = requestConfig.headers ?? {};
    requestConfig.headers["X-CSRFToken"] = csrfToken;
  }
  return requestConfig;
});

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<{ accessToken: string }>("/auth/refresh", {}, { skipAuthRefresh: true } as RetryableRequestConfig)
      .then(({ data }) => {
        accessToken = data.accessToken;
        return data.accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.skipAuthRefresh
    ) {
      throw error;
    }

    originalRequest._retry = true;
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      throw error;
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
    return api(originalRequest);
  }
);

export type AuthUser = {
  userId: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  group?: "admin" | "developer";
  isAdmin?: boolean;
  profileImg?: string;
  active?: boolean;
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ListUsersParams = {
  page?: number;
  search?: string;
  role?: string;
  status?: string;
};


export type UpdateUserPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type CreateUserPayload = {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  group?: "admin" | "developer";
  isAdmin?: boolean;
  active?: boolean;
};

export type CreateProjectPayload = {
  name: string;
  description: string;
  color: string;
  icon: string;
  team: number[]; // Array of User IDs
};

export type Project = {
  projectId: number;
  name: string;
  createdAt: string;
  description: string;
  color: string;
  icon: string;
  createdBy: number;
  authorProfileImg?: string | null;
};

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export type ProjectMembership = {
  projectMembershipId: number;
  projectId: number;
  userId: number;
  username: string;
  role: string;
  profileImg?: string | null;
};

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

export type NotificationItem = {
  notifyUserId: number;
  notificationId: number;
  type: string;
  createdAt: string;
  issueId?: number | null;
  projectId?: number | null;
  isRead: boolean;
  readAt?: string | null;
};

export async function loginApi(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<LoginResponse>(
    "/auth/login",
    { email, password },
    { skipAuthRefresh: true } as RetryableRequestConfig
  );
  accessToken = data.accessToken;
  return data.user;
}

export async function requestOtpApi(email: string): Promise<void> {
  await api.post("/auth/password/otp/request", { email });
}

export async function verifyOtpApi(email: string, code: string): Promise<{ valid: boolean }> {
  const { data } = await api.post<{ valid: boolean }>("/auth/password/otp/verify", { email, code });
  return data;
}

export async function resetPasswordApi(email: string, code: string, newPassword: string): Promise<void> {
  await api.post("/auth/password/reset", { email, code, newPassword });
}

export async function logoutApi(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    accessToken = null;
  }
}

export async function meApi(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
}

export async function updateUserApi(userId: number, payload: UpdateUserPayload): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>(`/users/${userId}`, payload);
  return data;
}

export async function changePasswordApi(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  await api.post(`/users/${userId}/change-password`, { currentPassword, newPassword });
}

export async function adminChangePasswordApi(userId: number, newPassword: string): Promise<void> {
  await api.post(`/users/${userId}/admin-reset-password`, { newPassword });
}

export async function adminUploadProfileImageApi(userId: number, file: File): Promise<AuthUser> {
  const formData = new FormData();
  formData.append("profile_img", file);
  const { data } = await api.post<AuthUser>(`/users/${userId}/admin-upload-image`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function createUserApi(payload: CreateUserPayload): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>("/users", payload);
  return data;
}

export async function listUsersApi(params?: ListUsersParams): Promise<PaginatedResponse<AuthUser>> {
  const { data } = await api.get<PaginatedResponse<AuthUser>>("/users", { params });
  return data;
}

export async function setUserActiveApi(userId: number, active: boolean): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>(`/users/${userId}`, { active });
  return data;
}

export async function uploadProfileImageApi(file: File): Promise<AuthUser> {
  const formData = new FormData();
  formData.append("profile_img", file);
  const { data } = await api.post<AuthUser>("/users/me/upload_profile_image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function listProjectsApi(search?: string): Promise<Project[]> {
  const params = search ? { q: search } : undefined;
  const { data } = await api.get<Project[]>("/projects", { params });
  return data;
}

export async function getProjectApi(projectId: string | number): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${projectId}`);
  return data;
}

export async function createProjectApi(payload: CreateProjectPayload): Promise<Project> {
  const { data } = await api.post<Project>("/projects", payload);
  return data;
}

export async function updateProjectApi(projectId: number | string, payload: UpdateProjectPayload): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${projectId}`, payload);
  return data;
}

export async function deleteProjectApi(projectId: number | string): Promise<void> {
  await api.delete(`/projects/${projectId}`);
}

export async function listProjectMembersApi(projectId: string | number): Promise<ProjectMembership[]> {
  const { data } = await api.get<ProjectMembership[]>(`/projects/${projectId}/members`);
  return data;
}

export async function listProjectIssuesApi(projectId: string | number): Promise<Issue[]> {
  const { data } = await api.get<Issue[]>(`/projects/${projectId}/issues`);
  return data;
}

export async function createProjectIssueApi(projectId: string | number, payload: CreateIssuePayload): Promise<Issue> {
  const { data } = await api.post<Issue>(`/projects/${projectId}/issues`, payload);
  return data;
}

export async function updateIssueDetailsApi(issueId: number | string, payload: UpdateIssuePayload): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${issueId}/details`, payload);
  return data;
}

export async function uploadAttachmentApi(
  file: File,
  issueId: number,
  message?: string
): Promise<IssueAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("issueId", String(issueId));
  if (message) formData.append("message", message);
  const { data } = await api.post<IssueAttachment>("/attachments", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listAttachmentsApi(params: { issueId?: number; updateId?: number }): Promise<IssueAttachment[]> {
  const { data } = await api.get<IssueAttachment[]>("/attachments", { params });
  return data;
}

export async function deleteAttachmentApi(attachmentId: number): Promise<void> {
  await api.delete(`/attachments/${attachmentId}`);
}



export async function getIssueApi(issueId: string | number): Promise<Issue> {
  const { data } = await api.get<Issue>(`/issues/${issueId}`);
  return data;
}

export async function updateIssueApi(issueId: number | string, payload: UpdateIssuePayload): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${issueId}`, payload);
  return data;
}

export async function listIssueUpdatesApi(issueId: string | number): Promise<IssueUpdate[]> {
  const { data } = await api.get<IssueUpdate[]>(`/issues/${issueId}/updates`);
  return data;
}

export async function listNotificationsApi(): Promise<NotificationItem[]> {
  const { data } = await api.get<NotificationItem[]>("/notifications");
  return data;
}

export async function readNotificationApi(notificationId: number): Promise<NotificationItem> {
  const { data } = await api.post<NotificationItem>(`/notifications/${notificationId}/read`);
  return data;
}

export async function readAllNotificationsApi(): Promise<{ updated: number }> {
  const { data } = await api.post<{ updated: number }>("/notifications/read-all");
  return data;
}

export async function deleteNotificationApi(notificationId: number): Promise<void> {
  await api.delete(`/notifications/${notificationId}`);
}

export function resolveMediaUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return "";
  const backendOrigin = import.meta.env.VITE_BACKEND_PUBLIC_ORIGIN ?? window.location.origin;

  if (pathOrUrl.startsWith("http://backend:8000")) {
    return `${backendOrigin}${pathOrUrl.slice("http://backend:8000".length)}`;
  }
  if (pathOrUrl.startsWith("https://backend:8000")) {
    return `${backendOrigin}${pathOrUrl.slice("https://backend:8000".length)}`;
  }
  if (pathOrUrl.startsWith("http://backend")) {
    return `${backendOrigin}${pathOrUrl.slice("http://backend".length)}`;
  }
  if (pathOrUrl.startsWith("https://backend")) {
    return `${backendOrigin}${pathOrUrl.slice("https://backend".length)}`;
  }
  if (pathOrUrl.startsWith("/media/")) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("media/")) {
    return `/${pathOrUrl}`;
  }
  return pathOrUrl;
}

export default api;
