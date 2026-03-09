import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const ACCESS_TOKEN_STORAGE_KEY = "bugboard_access_token";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

let accessToken: string | null = readStoredAccessToken();

export function setAccessToken(token: string | null): void {
  accessToken = token;

  if (typeof window === "undefined") return;

  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

const apiClient = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: apiBaseURL,
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

let csrfBootstrapPromise: Promise<unknown> | null = null;

async function ensureCsrfCookie(): Promise<void> {
  if (readCookie("csrftoken")) return;

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = refreshClient.get("/auth/csrf").finally(() => {
      csrfBootstrapPromise = null;
    });
  }

  await csrfBootstrapPromise;
}

function methodRequiresCsrf(method?: string): boolean {
  const normalized = (method ?? "get").toUpperCase();
  return (
    normalized !== "GET" &&
    normalized !== "HEAD" &&
    normalized !== "OPTIONS" &&
    normalized !== "TRACE"
  );
}

refreshClient.interceptors.request.use(async (config) => {
  if (!methodRequiresCsrf(config.method)) return config;

  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["X-CSRFToken"] = csrfToken;
  }

  return config;
});

apiClient.interceptors.request.use(async (config) => {
  if (methodRequiresCsrf(config.method)) {
    await ensureCsrfCookie();
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)["X-CSRFToken"] = csrfToken;
    }
  }

  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const statusCode = error.response?.status;
    const requestUrl = originalRequest?.url ?? "";

    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/csrf");

    if (statusCode !== 401 || !originalRequest || originalRequest._retry || isAuthRequest) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const { data } = await refreshClient.post<{ accessToken: string }>("/auth/refresh", {});
      setAccessToken(data.accessToken);

      originalRequest.headers = originalRequest.headers ?? {};
      (originalRequest.headers as Record<string, string>)["Authorization"] = `Bearer ${data.accessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      return Promise.reject(refreshError);
    }
  },
);

export { apiClient };
export default apiClient;
