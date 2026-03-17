import apiClient from "@shared/api/core/client";
import type { AuthUser } from "@shared/api/types/auth";
import type { PaginatedResponse } from "@shared/api/types/common";
import type { ListUsersParams } from "@shared/api/types/users";

export async function listUsersApi(params?: ListUsersParams): Promise<PaginatedResponse<AuthUser>> {
  const { data } = await apiClient.get<PaginatedResponse<AuthUser>>("/users", { params });
  return data;
}
