export type CreateProjectPayload = {
  name: string;
  description: string;
  color: string;
  icon: string;
  team: number[];
};

export type Project = {
  projectId: number;
  name: string;
  createdAt: string;
  description: string;
  color: string;
  icon: string;
  createdBy: number;
  authorProfileImg?: string | null;
};

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export type ProjectMembership = {
  projectMembershipId: number;
  projectId: number;
  userId: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  profileImg?: string | null;
};

export type ProjectSubscriptionState = {
  subscribed: boolean;
};
