import axios from "axios";

const apiClient = axios.create({
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

apiClient.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toUpperCase();
  const requiresCsrf =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE";
  if (!requiresCsrf) return config;

  const csrfToken = readCookie("csrftoken");
  if (csrfToken) {
    config.headers = config.headers ?? {};
    config.headers["X-CSRFToken"] = csrfToken;
  }
  return config;
});

export { apiClient };
export default apiClient;
