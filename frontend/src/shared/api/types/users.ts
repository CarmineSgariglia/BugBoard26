export type ListUsersParams = {
  page?: number;
  search?: string;
  role?: string;
  status?: string;
};

export type UpdateUserPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type CreateUserPayload = {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  active?: boolean;
};
