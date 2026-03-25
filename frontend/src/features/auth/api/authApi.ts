import axios from "axios";
import apiClient, { setAccessToken } from "@shared/api/core/client";
import type { AuthUser } from "@shared/api/types/auth";

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

type RefreshResponse = {
  accessToken: string;
};

export async function loginApi(email: string, password: string): Promise<AuthUser> {
  const { data } = await apiClient.post<LoginResponse>("/sessions", { email, password });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function requestOtpApi(email: string): Promise<void> {
  await apiClient.post("/password-reset-requests", { email });
}

export async function verifyOtpApi(email: string, code: string): Promise<{ valid: boolean }> {
  const { data } = await apiClient.post<{ valid: boolean }>("/password-reset-verifications", {
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
  await apiClient.post("/password-resets", { email, code, newPassword });
}

export async function logoutApi(): Promise<void> {
  try {
    await apiClient.delete("/sessions/current");
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const statusCode = error.response?.status;
    if (statusCode !== 401 && statusCode !== 403) {
      throw error;
    }
  }

  setAccessToken(null);
}

export async function meApi(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>("/users/me");
  return data;
}

export async function refreshApi(): Promise<string> {
  const { data } = await apiClient.post<RefreshResponse>("/sessions/current/access-token", {});
  setAccessToken(data.accessToken);
  return data.accessToken;
}
