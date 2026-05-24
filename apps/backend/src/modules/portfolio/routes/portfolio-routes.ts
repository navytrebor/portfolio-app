import type { FastifyInstance } from "fastify";
import type { IdentityService } from "../../identity/services/identity-service";
import type { PortfolioService } from "../services/portfolio-service";
import { requireRole } from "../../../auth/request-auth";

export async function registerPortfolioRoutes(
  app: FastifyInstance,
  portfolioService: PortfolioService,
  identityService: IdentityService,
) {
  app.get("/api/portfolios", async (request, reply) => {
    const context = await requireRole(
      request,
      reply,
      identityService,
      ["ADMIN", "TRADER", "ANALYST", "VIEWER"],
    );
    if (!context) {
      return;
    }

    const items = await portfolioService.listUserPortfolios(context.userId);
    return { items };
  });
}
