import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@portfolio/contracts";
import type { IdentityService } from "../modules/identity/services/identity-service";
import { authenticationRequired, forbidden, sendApiError } from "../http/api-errors";
import { createSignedToken, parseSignedToken } from "./signed-token";

export type { UserRole } from "@portfolio/contracts";

export type AuthenticatedContext = {
  userId: string;
  role: UserRole;
};

const ALL_ROLES: UserRole[] = ["ADMIN", "TRADER", "ANALYST", "VIEWER"];

function parseAuthToken(token: string): AuthenticatedContext | null {
  try {
    const parsed = parseSignedToken<{ role?: string; userId?: string }>(token);
    if (!parsed) {
      return null;
    }

    const userId =
      typeof parsed.userId === "string" && parsed.userId.trim().length > 0
        ? parsed.userId.trim()
        : null;
    const normalizedRole =
      typeof parsed.role === "string" ? parsed.role.trim().toUpperCase() : "";
    const role = ALL_ROLES.find((allowed) => allowed === normalizedRole) ?? null;

    return userId && role ? { userId, role } : null;
  } catch {
    return null;
  }
}

export function createAuthToken(context: AuthenticatedContext): string {
  return createSignedToken({
    userId: context.userId,
    role: context.role,
  });
}

export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  identityService: IdentityService,
  allowedRoles: UserRole[],
): Promise<AuthenticatedContext | null> {
  const authorization = request.headers.authorization;
  const bearerToken =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
  const context = bearerToken ? parseAuthToken(bearerToken) : null;

  if (!context) {
    sendApiError(
      reply,
      request.id,
      authenticationRequired("Authentication required. Provide a valid Bearer token."),
    );
    return null;
  }

  const user = await identityService.getUser(context.userId);
  if (!user) {
    sendApiError(
      reply,
      request.id,
      authenticationRequired("Authentication required. Provide a valid Bearer token."),
    );
    return null;
  }

  if (user.role !== context.role) {
    sendApiError(
      reply,
      request.id,
      forbidden("Token role no longer matches the user role", {
        currentRole: context.role,
        expectedRole: user.role,
      }),
    );
    return null;
  }

  if (!allowedRoles.includes(context.role)) {
    sendApiError(
      reply,
      request.id,
      forbidden("Insufficient role for this endpoint", {
        requiredRoles: allowedRoles,
        currentRole: context.role,
      }),
    );
    return null;
  }

  return context;
}
