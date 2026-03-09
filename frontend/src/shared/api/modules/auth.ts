import apiClient, { setAccessToken } from "../core/client";
import type { AuthUser } from "../types/auth";

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

type RefreshResponse = {
  accessToken: string;
};

export async function loginApi(email: string, password: string): Promise<AuthUser> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", { email, password });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function requestOtpApi(email: string): Promise<void> {
  await apiClient.post("/auth/password/otp/request", { email });
}

export async function verifyOtpApi(email: string, code: string): Promise<{ valid: boolean }> {
  const { data } = await apiClient.post<{ valid: boolean }>("/auth/password/otp/verify", {
    email,
    code,
  });
  return data;
}

export async function resetPasswordApi(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await apiClient.post("/auth/password/reset", { email, code, newPassword });
}

export async function refreshApi(): Promise<string> {
  const { data } = await apiClient.post<RefreshResponse>("/auth/refresh", {});
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function logoutApi(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
}

export async function meApi(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>("/auth/me");
  return data;
}
