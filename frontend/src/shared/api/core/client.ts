import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

const apiClient = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  withCredentials: true,
});

function readCookie(name: string): string {
  const escapedName = name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function hasContentTypeHeader(headers: unknown): boolean {
  if (!headers || typeof headers !== "object") return false;
  return Object.keys(headers as Record<string, unknown>).some(
    (key) => key.toLowerCase() === "content-type"
  );
}

function isFormDataPayload(payload: unknown): boolean {
  return typeof FormData !== "undefined" && payload instanceof FormData;
}

let csrfBootstrapPromise: Promise<unknown> | null = null;
let refreshPromise: Promise<string> | null = null;

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

async function refreshAccessTokenSingleFlight(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{ accessToken: string }>("/auth/refresh", {})
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch((error) => {
        setAccessToken(null);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
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

  if (
    config.data !== undefined &&
    !isFormDataPayload(config.data) &&
    !hasContentTypeHeader(config.headers)
  ) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["Content-Type"] = "application/json";
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
      await refreshAccessTokenSingleFlight();
      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export { apiClient };
export default apiClient;