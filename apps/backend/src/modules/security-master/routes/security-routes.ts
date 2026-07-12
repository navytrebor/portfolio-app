import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IdentityService } from "../../identity/services/identity-service";
import { rolePolicies } from "../../../auth/authorization-policies";
import type { SecurityMasterService } from "../services/security-master-service";
import { requireRole } from "../../../auth/request-auth";

const paramsSchema = z.object({
  securityId: z.string().uuid(),
});

export async function registerSecurityRoutes(
  app: FastifyInstance,
  securityMasterService: SecurityMasterService,
  identityService: IdentityService,
) {
  app.get("/api/securities", async (request, reply) => {
    if (!(await requireRole(request, reply, identityService, rolePolicies.securitiesRead))) {
      return;
    }

    const items = await securityMasterService.listSecurities();
    return { items };
  });

  app.get("/api/securities/:securityId", async (request, reply) => {
    if (!(await requireRole(request, reply, identityService, rolePolicies.securitiesRead))) {
      return;
    }

    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid security id",
        issues: parsed.error.issues,
      });
    }

    const security = await securityMasterService.getSecurity(parsed.data.securityId);
    if (!security) {
      return reply.status(404).send({ message: "Security not found" });
    }

    return security;
  });
}
