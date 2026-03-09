import apiClient from "../core/client";
import type { AuthUser } from "../types/auth";

export async function loginApi(email: string, password: string): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>("/auth/login/", { email, password });
  return data;
}

export async function requestOtpApi(email: string): Promise<void> {
  await apiClient.post("/auth/password/otp/request/", { email });
}

export async function verifyOtpApi(email: string, code: string): Promise<{ valid: boolean }> {
  const { data } = await apiClient.post<{ valid: boolean }>("/auth/password/otp/verify/", {
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
  await apiClient.post("/auth/password/reset/", { email, code, newPassword });
}

export async function logoutApi(): Promise<void> {
  await apiClient.post("/auth/logout/");
}

export async function meApi(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>("/auth/me/");
  return data;
}
