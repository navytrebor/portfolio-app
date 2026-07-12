import type { UserRole } from "@portfolio/contracts";

export const rolePolicies = {
  portfoliosRead: ["ADMIN", "TRADER", "ANALYST", "VIEWER"],
  securitiesRead: ["ADMIN", "TRADER", "ANALYST", "VIEWER"],
  tradesRead: ["ADMIN", "TRADER", "ANALYST", "VIEWER"],
  tradesWrite: ["ADMIN", "TRADER"],
  valuationsRun: ["ADMIN", "ANALYST"],
  analyticsRun: ["ADMIN", "ANALYST"],
} satisfies Record<string, UserRole[]>;
