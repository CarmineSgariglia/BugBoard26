export type ListUsersParams = {
  page?: number;
  search?: string;
  role?: string;
  status?: string;
  userIds?: string;
  excludeUserIds?: string;
};

export type UpdateUserPayload = {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type CreateUserPayload = {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  active?: boolean;
};
