import type { FastifyInstance } from "fastify";
import {
  authLoginInitiateRequestSchema,
  authLoginVerifyRequestSchema,
  authMfaEnrollRequestSchema,
} from "@portfolio/contracts";
import { apiV1Path } from "../../../http/api-versioning";
import { badRequest, sendApiError } from "../../../http/api-errors";
import { requireRole } from "../../../auth/request-auth";
import type { IdentityService } from "../services/identity-service";

export async function registerAuthRoutes(app: FastifyInstance, identityService: IdentityService) {
  app.post(apiV1Path("/auth/login/initiate"), async (request, reply) => {
    const parsed = authLoginInitiateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request.id, badRequest("Invalid login payload", parsed.error.issues));
    }

    return identityService.startLogin(parsed.data.email);
  });

  app.post(apiV1Path("/auth/mfa/enroll"), async (request, reply) => {
    const parsed = authMfaEnrollRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request.id, badRequest("Invalid MFA enrollment payload", parsed.error.issues));
    }

    return identityService.completeMfaEnrollment(parsed.data.enrollmentToken, parsed.data.code);
  });

  app.post(apiV1Path("/auth/login/verify"), async (request, reply) => {
    const parsed = authLoginVerifyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request.id, badRequest("Invalid MFA verification payload", parsed.error.issues));
    }

    return identityService.verifyLoginChallenge(parsed.data.challengeToken, parsed.data.code);
  });

  app.get(apiV1Path("/auth/me"), async (request, reply) => {
    const context = await requireRole(
      request,
      reply,
      identityService,
      ["ADMIN", "TRADER", "ANALYST", "VIEWER"],
    );
    if (!context) {
      return;
    }

    const user = await identityService.getAuthenticatedUserView(context.userId);
    return { user };
  });

  app.post(apiV1Path("/auth/logout"), async () => {
    return { ok: true };
  });
}