import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IdentityService } from "../../identity/services/identity-service";
import type { PortfolioService } from "../../portfolio/services/portfolio-service";
import type { PerformanceService } from "../application/services/performance-service";
import { requireRole } from "../../../auth/request-auth";

const runPerformanceSchema = z.object({
  portfolioId: z.string().uuid(),
  asOf: z.string().datetime(),
});

export async function registerPerformanceRoutes(
  app: FastifyInstance,
  performanceService: PerformanceService,
  portfolioService: PortfolioService,
  identityService: IdentityService,
) {
  app.post("/api/analytics/performance/run", async (request, reply) => {
    const context = await requireRole(request, reply, identityService, ["ADMIN", "ANALYST"]);
    if (!context) {
      return;
    }

    const parsed = runPerformanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid performance payload",
        issues: parsed.error.issues,
      });
    }

    if (context.role !== "ADMIN") {
      const portfolios = await portfolioService.listUserPortfolios(context.userId);
      const hasAccess = portfolios.some((portfolio) => portfolio.id === parsed.data.portfolioId);
      if (!hasAccess) {
        return reply.status(403).send({ message: "Portfolio access denied" });
      }
    }

    const metrics = await performanceService.computeAndStore(
      parsed.data.portfolioId,
      parsed.data.asOf,
    );

    return reply.status(201).send(metrics);
  });
}
