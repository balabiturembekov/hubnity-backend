import { UserRole } from "@prisma/client";

export interface ICurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  role: UserRole;
}
