import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IdentityService } from "../../identity/services/identity-service";
import { rolePolicies } from "../../../auth/authorization-policies";
import type { SecurityMasterService } from "../services/security-master-service";
import { requireRole } from "../../../auth/request-auth";
import { badRequest, notFound, sendApiError } from "../../../http/api-errors";
import { apiV1Path } from "../../../http/api-versioning";
import { paginateItems, parsePaginationQuery } from "../../../http/pagination";
import { parseSecurityFilters } from "../../../http/query-filters";

const paramsSchema = z.object({
  securityId: z.string().uuid(),
});

export async function registerSecurityRoutes(
  app: FastifyInstance,
  securityMasterService: SecurityMasterService,
  identityService: IdentityService,
) {
  app.get(apiV1Path("/securities"), async (request, reply) => {
    if (!(await requireRole(request, reply, identityService, rolePolicies.securitiesRead))) {
      return;
    }

    const pagination = parsePaginationQuery(request.query);
    const filters = parseSecurityFilters(request.query);
    const items = (await securityMasterService.listSecurities()).filter((security) => {
      if (filters.ticker && security.ticker !== filters.ticker.toUpperCase()) {
        return false;
      }

      if (filters.currency && security.currency !== filters.currency.toUpperCase()) {
        return false;
      }

      if (filters.securityType && security.securityType !== filters.securityType.toUpperCase()) {
        return false;
      }

      return true;
    });

    return paginateItems(items, pagination);
  });

  app.get(apiV1Path("/securities/:securityId"), async (request, reply) => {
    if (!(await requireRole(request, reply, identityService, rolePolicies.securitiesRead))) {
      return;
    }

    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return sendApiError(reply, request.id, badRequest("Invalid security id", parsed.error.issues));
    }

    const security = await securityMasterService.getSecurity(parsed.data.securityId);
    if (!security) {
      return sendApiError(reply, request.id, notFound("Security not found"));
    }

    return security;
  });
}
