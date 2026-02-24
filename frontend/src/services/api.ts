import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export type HealthResponse = {
  status: string;
};

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

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>("/health/");
  return data;
}

export async function loginApi(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>("/auth/login/", { email, password });
  return data;
}

export async function logoutApi(): Promise<void> {
  await api.post("/auth/logout/");
}

export async function meApi(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me/");
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

export default api;
