import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function readCookie(name: string): string {
  const escapedName = name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toUpperCase();
  const requiresCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE";
  if (!requiresCsrf) return config;

  const csrfToken = readCookie("csrftoken");
  if (csrfToken) {
    config.headers = config.headers ?? {};
    config.headers["X-CSRFToken"] = csrfToken;
  }
  return config;
});

export type AuthUser = {
  userId: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  profileImg?: string;
  active?: boolean;
};

export type Project = {
  projectId: number;
  name: string;
  createdAt: string;
  description: string;
  color: string;
  icon: string;
  createdBy: number;
};

export type Issue = {
  issueId: number;
  projectId: number;
  reporterId: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
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
  const { data } = await api.post<AuthUser>("/auth/login/", { email, password });
  return data;
}

export async function requestOtpApi(email: string): Promise<void> {
  await api.post("/auth/password/otp/request/", { email });
}

export async function verifyOtpApi(email: string, code: string): Promise<{ valid: boolean }> {
  const { data } = await api.post<{ valid: boolean }>("/auth/password/otp/verify/", { email, code });
  return data;
}

export async function resetPasswordApi(email: string, code: string, newPassword: string): Promise<void> {
  await api.post("/auth/password/reset/", { email, code, newPassword });
}

export async function logoutApi(): Promise<void> {
  await api.post("/auth/logout/");
}

export async function meApi(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me/");
  return data;
}

export async function listProjectsApi(search?: string): Promise<Project[]> {
  const params = search ? { q: search } : undefined;
  const { data } = await api.get<Project[]>("/projects/", { params });
  return data;
}

export async function listProjectIssuesApi(projectId: string | number): Promise<Issue[]> {
  const { data } = await api.get<Issue[]>(`/projects/${projectId}/issues/`);
  return data;
}

export async function listNotificationsApi(): Promise<NotificationItem[]> {
  const { data } = await api.get<NotificationItem[]>("/notifications/");
  return data;
}

export async function readNotificationApi(notificationId: number): Promise<NotificationItem> {
  const { data } = await api.post<NotificationItem>(`/notifications/${notificationId}/read/`);
  return data;
}

export async function readAllNotificationsApi(): Promise<{ updated: number }> {
  const { data } = await api.post<{ updated: number }>("/notifications/read-all/");
  return data;
}

export function resolveMediaUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return "";
  const backendOrigin =
    import.meta.env.VITE_BACKEND_PUBLIC_ORIGIN ?? `${window.location.protocol}//${window.location.hostname}:8000`;

  if (pathOrUrl.startsWith("http://backend:8000")) {
    return `${backendOrigin}${pathOrUrl.slice("http://backend:8000".length)}`;
  }
  if (pathOrUrl.startsWith("https://backend:8000")) {
    return `${backendOrigin}${pathOrUrl.slice("https://backend:8000".length)}`;
  }
  if (pathOrUrl.startsWith("/media/")) {
    return `${backendOrigin}${pathOrUrl}`;
  }
  if (pathOrUrl.startsWith("media/")) {
    return `${backendOrigin}/${pathOrUrl}`;
  }
  return pathOrUrl;
}

export default api;
