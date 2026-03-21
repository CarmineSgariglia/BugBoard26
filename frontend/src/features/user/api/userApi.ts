import apiClient from "@shared/api/core/client";
import { withRequestOptions } from "@shared/api/core/config";
import type { RequestOptions } from "@shared/api";
import type { AuthUser } from "@shared/api/types/auth";
import type { PaginatedResponse } from "@shared/api/types/common";
import type { ListUsersParams } from "@shared/api/types/users";

export async function listUsersApi(
  params?: ListUsersParams,
  options?: RequestOptions,
): Promise<PaginatedResponse<AuthUser>> {
  const { data } = await apiClient.get<PaginatedResponse<AuthUser>>(
    "/users",
    withRequestOptions({ params }, options),
  );
  return data;
}
