import type { UserRole } from "@portfolio/contracts";

export type User = {
  id: string;
  email: string;
  role: UserRole;
  mfaSecret: string | null;
  mfaEnrolledAt: string | null;
  createdAt: string;
};
