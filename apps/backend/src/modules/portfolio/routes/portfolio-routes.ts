import type { FastifyInstance } from "fastify";
import type { IdentityService } from "../../identity/services/identity-service";
import type { PortfolioService } from "../services/portfolio-service";
import { rolePolicies } from "../../../auth/authorization-policies";
import { requireRole } from "../../../auth/request-auth";
import { apiV1Path } from "../../../http/api-versioning";
import { paginateItems, parsePaginationQuery } from "../../../http/pagination";

export async function registerPortfolioRoutes(
  app: FastifyInstance,
  portfolioService: PortfolioService,
  identityService: IdentityService,
) {
  app.get(apiV1Path("/portfolios"), async (request, reply) => {
    const context = await requireRole(
      request,
      reply,
      identityService,
      rolePolicies.portfoliosRead,
    );
    if (!context) {
      return;
    }

    const pagination = parsePaginationQuery(request.query);
    const items = await portfolioService.listUserPortfolios(context.userId);
    return paginateItems(items, pagination);
  });
}
