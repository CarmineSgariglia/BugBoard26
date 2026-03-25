export type AuthUser = {
  userId: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  isSuperuser?: boolean;
  profileImg?: string | null;
  active?: boolean;
};
