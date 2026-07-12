import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IdentityService } from "../../identity/services/identity-service";
import type { PortfolioService } from "../../portfolio/services/portfolio-service";
import { rolePolicies } from "../../../auth/authorization-policies";
import type { ValuationService } from "../application/services/valuation-service";
import { requireRole } from "../../../auth/request-auth";
import { apiV1Path } from "../../../http/api-versioning";
import { badRequest, forbidden, sendApiError } from "../../../http/api-errors";

const runValuationSchema = z.object({
  portfolioId: z.string().uuid(),
  asOf: z.string().datetime(),
});

export async function registerValuationRoutes(
  app: FastifyInstance,
  valuationService: ValuationService,
  portfolioService: PortfolioService,
  identityService: IdentityService,
) {
  app.post(apiV1Path("/valuations/run"), async (request, reply) => {
    const context = await requireRole(
      request,
      reply,
      identityService,
      rolePolicies.valuationsRun,
    );
    if (!context) {
      return;
    }

    const parsed = runValuationSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request.id, badRequest("Invalid valuation payload", parsed.error.issues));
    }

    if (context.role !== "ADMIN") {
      const portfolios = await portfolioService.listUserPortfolios(context.userId);
      const hasAccess = portfolios.some((portfolio) => portfolio.id === parsed.data.portfolioId);
      if (!hasAccess) {
        return sendApiError(reply, request.id, forbidden("Portfolio access denied"));
      }
    }

    const snapshot = await valuationService.runPortfolioValuation(
      parsed.data.portfolioId,
      parsed.data.asOf,
    );

    return reply.status(201).send(snapshot);
  });
}
