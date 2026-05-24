import type { FastifyInstance } from "fastify";
import type { PortfolioService } from "../services/portfolio-service";
import { requireRole } from "../../../auth/request-auth";

export async function registerPortfolioRoutes(
  app: FastifyInstance,
  portfolioService: PortfolioService,
) {
  app.get("/api/portfolios", async (request, reply) => {
    const context = requireRole(request, reply, ["ADMIN", "TRADER", "ANALYST", "VIEWER"]);
    if (!context) {
      return;
    }

    const items = await portfolioService.listUserPortfolios(context.userId);
    return { items };
  });
}
