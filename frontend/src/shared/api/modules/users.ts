import apiClient from "../core/client";
import type { AuthUser } from "../types/auth";
import type { PaginatedResponse } from "../types/common";
import type { CreateUserPayload, ListUsersParams, UpdateUserPayload } from "../types/users";

export async function updateUserApi(userId: number, payload: UpdateUserPayload): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>(`/users/${userId}`, payload);
  return data;
}

export async function changePasswordApi(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient.post(`/users/${userId}/change-password`, { currentPassword, newPassword });
}

export async function adminChangePasswordApi(userId: number, newPassword: string): Promise<void> {
  await apiClient.post(`/users/${userId}/admin-reset-password`, { newPassword });
}

export async function adminUploadProfileImageApi(userId: number, file: File): Promise<AuthUser> {
  const formData = new FormData();
  formData.append("profile_img", file);
  const { data } = await apiClient.post<AuthUser>(`/users/${userId}/admin-upload-image`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function createUserApi(payload: CreateUserPayload): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>("/users", payload);
  return data;
}

export async function listUsersApi(params?: ListUsersParams): Promise<PaginatedResponse<AuthUser>> {
  const { data } = await apiClient.get<PaginatedResponse<AuthUser>>("/users", { params });
  return data;
}

export async function setUserActiveApi(userId: number, active: boolean): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>(`/users/${userId}`, { active });
  return data;
}

export async function uploadProfileImageApi(file: File): Promise<AuthUser> {
  const formData = new FormData();
  formData.append("profile_img", file);
  const { data } = await apiClient.post<AuthUser>("/users/me/upload_profile_image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}
