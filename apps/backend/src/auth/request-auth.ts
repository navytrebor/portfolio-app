import type { FastifyReply, FastifyRequest } from "fastify";

export type UserRole = "ADMIN" | "TRADER" | "ANALYST" | "VIEWER";

export type AuthenticatedContext = {
  userId: string;
  role: UserRole;
};

const ALL_ROLES: UserRole[] = ["ADMIN", "TRADER", "ANALYST", "VIEWER"];

export function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedRoles: UserRole[],
): AuthenticatedContext | null {
  const userIdHeader = request.headers["x-user-id"];
  const roleHeader = request.headers["x-user-role"];

  const userId =
    typeof userIdHeader === "string" && userIdHeader.trim().length > 0
      ? userIdHeader.trim()
      : null;

  const normalizedRole =
    typeof roleHeader === "string" ? roleHeader.trim().toUpperCase() : "";

  const role = ALL_ROLES.find((allowed) => allowed === normalizedRole) ?? null;

  if (!userId || !role) {
    void reply.status(401).send({
      message: "Authentication required. Provide x-user-id and x-user-role headers.",
    });
    return null;
  }

  if (!allowedRoles.includes(role)) {
    void reply.status(403).send({
      message: "Insufficient role for this endpoint",
      requiredRoles: allowedRoles,
      currentRole: role,
    });
    return null;
  }

  return { userId, role };
}
