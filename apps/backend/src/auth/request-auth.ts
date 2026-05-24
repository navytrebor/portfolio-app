import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";
import type { IdentityService } from "../modules/identity/services/identity-service";

export type UserRole = "ADMIN" | "TRADER" | "ANALYST" | "VIEWER";

export type AuthenticatedContext = {
  userId: string;
  role: UserRole;
};

const ALL_ROLES: UserRole[] = ["ADMIN", "TRADER", "ANALYST", "VIEWER"];

function signTokenPayload(payload: string): string {
  return createHmac("sha256", env.AUTH_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");
}

function parseAuthToken(token: string): AuthenticatedContext | null {
  const [payloadSegment, signatureSegment, ...rest] = token.split(".");
  if (!payloadSegment || !signatureSegment || rest.length > 0) {
    return null;
  }

  const expectedSignature = signTokenPayload(payloadSegment);
  try {
    if (
      !timingSafeEqual(
        Buffer.from(signatureSegment),
        Buffer.from(expectedSignature),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as {
      role?: string;
      userId?: string;
    };

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
  const payload = Buffer.from(
    JSON.stringify({
      userId: context.userId,
      role: context.role,
    }),
  ).toString("base64url");

  return `${payload}.${signTokenPayload(payload)}`;
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
    void reply.status(401).send({
      message: "Authentication required. Provide a valid Bearer token.",
    });
    return null;
  }

  const user = await identityService.getUser(context.userId);
  if (!user) {
    void reply.status(401).send({
      message: "Authentication required. Provide a valid Bearer token.",
    });
    return null;
  }

  if (!allowedRoles.includes(context.role)) {
    void reply.status(403).send({
      message: "Insufficient role for this endpoint",
      requiredRoles: allowedRoles,
      currentRole: context.role,
    });
    return null;
  }

  return context;
}
