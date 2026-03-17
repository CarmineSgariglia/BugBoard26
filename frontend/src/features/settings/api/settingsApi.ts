import apiClient from "@shared/api/core/client";
import type { AuthUser } from "@shared/api/types/auth";
import type { CreateUserPayload, UpdateUserPayload } from "@shared/api/types/users";
import { prepareProfileImageUpload } from "@shared/lib/media";

export async function updateSettingsUserApi(userId: number, payload: UpdateUserPayload): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>(`/users/${userId}`, payload);
  return data;
}

export async function changeSettingsPasswordApi(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient.post(`/users/${userId}/change-password`, { currentPassword, newPassword });
}

export async function adminChangeSettingsPasswordApi(userId: number, newPassword: string): Promise<void> {
  await apiClient.post(`/users/${userId}/admin-reset-password`, { newPassword });
}

export async function adminUploadSettingsProfileImageApi(userId: number, file: File): Promise<AuthUser> {
  const preparedFile = await prepareProfileImageUpload(file);
  const formData = new FormData();
  formData.append("profile_img", preparedFile);
  const { data } = await apiClient.post<AuthUser>(`/users/${userId}/admin-upload-image`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function createSettingsUserApi(payload: CreateUserPayload): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>("/users", payload);
  return data;
}

export async function setSettingsUserActiveApi(userId: number, active: boolean): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>(`/users/${userId}`, { active });
  return data;
}

export async function uploadSettingsProfileImageApi(file: File): Promise<AuthUser> {
  const preparedFile = await prepareProfileImageUpload(file);
  const formData = new FormData();
  formData.append("profile_img", preparedFile);
  const { data } = await apiClient.post<AuthUser>("/users/me/upload-profile-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}
